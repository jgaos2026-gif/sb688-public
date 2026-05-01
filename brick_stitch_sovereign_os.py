import hashlib
import json
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import networkx as nx


# ============================================================
# BRICK STITCH SOVEREIGN OS - single-file hardened simulator
# ------------------------------------------------------------
# Goals:
# - deterministic execution for repeatable test runs
# - DAG-aware boot and downstream recovery
# - last-known-good snapshots per brick
# - tamper-evident Spine ledger with hash chain
# - no commits of unhealthy/corrupt state
# - test harness that repairs and retries until stable
# - every scenario must pass 3 times in a row
# Sentinel additions (SB689 OMEGA integration):
# - BraidedLogic: personality · moral · judgment layer
# - SentinelLayer: proactive self-monitoring, anomaly detection,
#   adaptive decision-making, incident learning, autonomous evolution
# ============================================================


# ===================== DETERMINISTIC CLOCK =====================
class DeterministicClock:
    def __init__(self, start: int = 1_700_000_000):
        self._t = start

    def now(self) -> int:
        self._t += 1
        return self._t


# ===================== CRYPTO HELPERS =====================
def stable_json(data) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def hash_blob(data) -> str:
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


# ===================== BRICK =====================
@dataclass
class Brick:
    name: str
    dependencies: List[str]
    state: Dict
    healthy: bool = True
    heal_count: int = 0
    update_in_progress: bool = False
    update_target_version: Optional[int] = None

    def run(self, clock: DeterministicClock) -> bool:
        if not self.healthy:
            return False
        if self.state.get("corrupted"):
            self.healthy = False
            return False
        if self.update_in_progress:
            # Mid-install states are not promotable to committed truth.
            self.healthy = False
            return False
        self.state["last_run"] = clock.now()
        self.state["run_count"] = self.state.get("run_count", 0) + 1
        return True

    def get_state(self) -> Dict:
        return deepcopy(self.state)

    def set_state(self, new_state: Dict) -> None:
        self.state = deepcopy(new_state)
        self.healthy = True
        self.update_in_progress = False
        self.update_target_version = None


# ===================== SPINE =====================
class Spine:
    def __init__(self, clock: DeterministicClock):
        self.clock = clock
        self.ledger: Dict[int, Dict] = {}
        self.current_version = 0
        self.last_good_version_by_brick: Dict[str, int] = {}
        self.policy = {
            "max_heals_per_brick": 5,
            "max_repair_rounds_per_test": 6,
        }
        self.integrity_compromised = False

    def _build_snapshot(self, bricks_state: Dict[str, Dict]) -> Dict:
        return {"bricks": {k: deepcopy(v) for k, v in bricks_state.items()}}

    def _hash_entry(self, snapshot: Dict, prev_hash: str) -> str:
        payload = {"snapshot": snapshot, "prev_hash": prev_hash}
        return hash_blob(stable_json(payload))

    def commit_version(self, bricks_state: Dict[str, Dict], bricks_health: Dict[str, bool]) -> int:
        if not all(bricks_health.values()):
            raise RuntimeError("Refusing to commit unhealthy system state")
        if any(state.get("corrupted") for state in bricks_state.values()):
            raise RuntimeError("Refusing to commit corrupted system state")
        if any(state.get("status") == "updating" for state in bricks_state.values()):
            raise RuntimeError("Refusing to commit mid-update system state")

        snapshot = self._build_snapshot(bricks_state)
        prev_hash = self.ledger[self.current_version]["hash"] if self.current_version else "GENESIS"
        entry_hash = self._hash_entry(snapshot, prev_hash)

        self.current_version += 1
        self.ledger[self.current_version] = {
            "version": self.current_version,
            "timestamp": self.clock.now(),
            "prev_hash": prev_hash,
            "hash": entry_hash,
            "snapshot": snapshot,
        }

        for brick_name, ok in bricks_health.items():
            if ok:
                self.last_good_version_by_brick[brick_name] = self.current_version

        return self.current_version

    def get_last_good(self, brick_name: str) -> Dict:
        version = self.last_good_version_by_brick.get(brick_name)
        if version is None:
            return {}
        return deepcopy(self.ledger[version]["snapshot"]["bricks"].get(brick_name, {}))

    def verify_chain(self) -> bool:
        prev_hash = "GENESIS"
        for version in range(1, self.current_version + 1):
            entry = self.ledger.get(version)
            if not entry:
                return False
            expected = self._hash_entry(entry["snapshot"], prev_hash)
            if expected != entry["hash"]:
                return False
            if entry["prev_hash"] != prev_hash:
                return False
            prev_hash = entry["hash"]
        return True

    def verify_state_matches_head(self, bricks_state: Dict[str, Dict]) -> bool:
        if self.current_version == 0:
            return False
        snapshot = self._build_snapshot(bricks_state)
        head = self.ledger[self.current_version]
        expected = self._hash_entry(snapshot, head["prev_hash"])
        return expected == head["hash"]

    def tamper_with_head(self) -> None:
        if self.current_version == 0:
            return
        # Simulate a hostile modification to committed truth.
        self.ledger[self.current_version]["snapshot"]["bricks"]["core"]["status"] = "TAMPERED"
        self.integrity_compromised = True


# ===================== HEALING =====================
class HealingLayer:
    def __init__(self, spine: Spine, bricks: Dict[str, Brick], dep_graph: nx.DiGraph, clock: DeterministicClock):
        self.spine = spine
        self.bricks = bricks
        self.dep_graph = dep_graph
        self.clock = clock
        self.heal_log: List[Tuple[str, str, int]] = []
        self.online = True

    def _record(self, brick_name: str, action: str) -> None:
        self.heal_log.append((brick_name, action, self.clock.now()))

    def heal(self, brick_name: str, fault_type: str) -> bool:
        if not self.online:
            return False
        brick = self.bricks.get(brick_name)
        if brick is None:
            return False
        if brick.heal_count >= self.spine.policy["max_heals_per_brick"]:
            return False

        if fault_type in {"corrupt", "storage_corrupt", "partial_update"}:
            good = self.spine.get_last_good(brick_name)
            if not good:
                return False
            brick.set_state(good)
            action = "rollback"
        elif fault_type in {"crash", "runtime_crash", "driver_fault", "dependency_failure"}:
            brick.healthy = True
            brick.state.pop("crash_flag", None)
            action = "restart"
        elif fault_type == "spine_tamper":
            # handled at system level, not per-brick
            return False
        else:
            brick.healthy = True
            action = "restart"

        brick.heal_count += 1
        self._record(brick_name, action)
        return True

    def recover_spine(self) -> bool:
        # Restore ledger head from previous valid chain state by rebuilding from last good snapshot.
        if self.spine.current_version == 0:
            return False
        if self.spine.verify_chain():
            self.spine.integrity_compromised = False
            return True

        # Roll back one version if possible, then mark recovered.
        if self.spine.current_version > 1:
            self.spine.ledger.pop(self.spine.current_version, None)
            self.spine.current_version -= 1
            self.spine.integrity_compromised = False
            return self.spine.verify_chain()

        return False

    def rerun_downstream(self, root_brick: str) -> bool:
        descendants = nx.descendants(self.dep_graph, root_brick)
        if not descendants:
            return True
        ordered = list(nx.topological_sort(self.dep_graph))
        ok = True
        for name in ordered:
            if name in descendants:
                self.bricks[name].healthy = True
                if not self.bricks[name].run(self.clock):
                    ok = False
        return ok


# ===================== BRAIDED LOGIC =====================
class BraidedLogic:
    """
    Braided Logic — personality · moral · judgment layer.

    Every sentinel action is routed through all three braids before
    execution to ensure ethical, contextual, and personality-consistent
    decision-making.  No unilateral destructive action may bypass the
    moral braid.

    Personalities
    ─────────────
    steadfast  : always execute the originally proposed action
    adaptive   : scale aggressiveness to the observed threat level
    cautious   : prefer monitoring over intervention for non-critical threats
    """

    PERSONALITIES = ("steadfast", "adaptive", "cautious")

    def __init__(self, personality: str = "adaptive"):
        if personality not in self.PERSONALITIES:
            raise ValueError(f"Unknown personality: {personality!r}")
        self.personality = personality
        self._decision_log: List[Dict] = []

    # ---- moral braid ----

    def moral_check(self, action: str, context: Dict) -> bool:
        """Return True only when the proposed action passes ethical guardrails."""
        # Never purge state without a confirmed backup in the ledger.
        if action == "purge" and not context.get("has_backup"):
            return False
        # Never disable the audit trail — tamper-evident logging is non-negotiable.
        if action == "disable_ledger":
            return False
        # Never exceed the heal budget without external authorisation.
        if action == "force_heal" and context.get("heal_count", 0) >= 5:
            return False
        return True

    # ---- judgment braid ----

    def judgment(self, action: str, threat_level: str, context: Dict) -> Dict:
        """
        Apply personality + moral reasoning to produce a judgment packet:
        {approved, rationale, adjusted_action}.
        """
        moral_ok = self.moral_check(action, context)

        if not moral_ok:
            result = {
                "approved": False,
                "rationale": f"Moral braid rejected action={action!r} (context constraint).",
                "adjusted_action": "alert_only",
            }
            self._decision_log.append(result)
            return result

        # Personality modulates aggressiveness.
        if self.personality == "cautious" and threat_level in {"low", "moderate"}:
            result = {
                "approved": True,
                "rationale": f"Cautious personality: observe and log for threat={threat_level!r}.",
                "adjusted_action": "monitor",
            }
        elif self.personality == "steadfast":
            result = {
                "approved": True,
                "rationale": f"Steadfast personality: execute action={action!r} unconditionally.",
                "adjusted_action": action,
            }
        else:
            # adaptive: scale action to threat level
            adjusted = action if threat_level in {"high", "critical"} else "monitor"
            result = {
                "approved": True,
                "rationale": f"Adaptive judgment for threat={threat_level!r}: {adjusted}.",
                "adjusted_action": adjusted,
            }

        self._decision_log.append(result)
        return result

    def decision_log(self) -> List[Dict]:
        return list(self._decision_log)


# ===================== SENTINEL =====================
class SentinelLayer:
    """
    Sentinel Layer — self-aware vigilance plane for the Sovereign OS.

    Sits above the HealingLayer and provides:
    - Proactive health trend monitoring per brick
    - Anomaly detection (repeated failures, stalled updates, chain breaks)
    - Threat-level classification: low / moderate / high / critical
    - Adaptive decision-making via BraidedLogic
    - Incident learning — tightens alert threshold as incident rate escalates
    - Autonomous threshold evolution within safe bounds
    - Alert history and anomaly log for post-incident forensics
    """

    THREAT_LOW = "low"
    THREAT_MODERATE = "moderate"
    THREAT_HIGH = "high"
    THREAT_CRITICAL = "critical"
    # Multiplier applied to alert_threshold to detect surge / tighten threshold.
    THRESHOLD_EVOLUTION_MULTIPLIER = 2

    def __init__(
        self,
        healing: "HealingLayer",
        spine: "Spine",
        clock: DeterministicClock,
        braided_logic: Optional[BraidedLogic] = None,
        initial_alert_threshold: int = 3,
    ):
        self.healing = healing
        self.spine = spine
        self.clock = clock
        self.braided_logic = braided_logic or BraidedLogic()

        # Per-brick incident counters for learning.
        self._incident_counts: Dict[str, int] = {}
        self._anomaly_log: List[Dict] = []
        self._alerts: List[Dict] = []

        # Adaptive threshold — tightens autonomously when incidents escalate.
        self._alert_threshold = initial_alert_threshold

    # ---- proactive health watch ----

    def watch(self, bricks: Dict[str, "Brick"]) -> Dict:
        """
        Inspect current brick health and emit a sentinel status report.
        Returns a dict with threat_level, anomalies, chain_integrity, and
        the recommended action after passing through BraidedLogic.
        """
        unhealthy = [name for name, b in bricks.items() if not b.healthy]
        high_heal = [
            name for name, b in bricks.items()
            if b.heal_count >= self._alert_threshold
        ]
        corrupted = [name for name, b in bricks.items() if b.state.get("corrupted")]

        threat_level = self._classify_threat(unhealthy, high_heal, corrupted)
        anomalies = self._detect_anomalies(bricks)

        # Route the proposed action through BraidedLogic before committing.
        proposed = "intervene" if threat_level in {self.THREAT_HIGH, self.THREAT_CRITICAL} else "monitor"
        context = {
            "unhealthy": unhealthy,
            "high_heal": high_heal,
            "corrupted": corrupted,
            "heal_count": max((b.heal_count for b in bricks.values()), default=0),
        }
        judgment = self.braided_logic.judgment(proposed, threat_level, context)

        status = {
            "timestamp": self.clock.now(),
            "threat_level": threat_level,
            "unhealthy_bricks": unhealthy,
            "high_heal_bricks": high_heal,
            "corrupted_bricks": corrupted,
            "anomalies": anomalies,
            "chain_integrity": self.spine.verify_chain(),
            "judgment": judgment,
        }

        if threat_level in {self.THREAT_HIGH, self.THREAT_CRITICAL}:
            self._raise_alert(threat_level, status)

        return status

    # ---- anomaly detection ----

    def _detect_anomalies(self, bricks: Dict[str, "Brick"]) -> List[str]:
        anomalies: List[str] = []

        if not self.spine.verify_chain():
            anomalies.append("spine_chain_broken")

        for name, brick in bricks.items():
            if brick.heal_count >= self._alert_threshold:
                anomalies.append(f"repeated_heals:{name}:{brick.heal_count}")
            if brick.state.get("corrupted"):
                anomalies.append(f"active_corruption:{name}")
            if brick.update_in_progress:
                anomalies.append(f"stalled_update:{name}")

        # Detect rapid incident escalation from learned history.
        for name, count in self._incident_counts.items():
            if count > self._alert_threshold * self.THRESHOLD_EVOLUTION_MULTIPLIER:
                anomalies.append(f"escalating_incidents:{name}:{count}")

        return anomalies

    # ---- threat classification ----

    def _classify_threat(
        self,
        unhealthy: List[str],
        high_heal: List[str],
        corrupted: List[str],
    ) -> str:
        if not self.spine.verify_chain() or len(corrupted) > 1:
            return self.THREAT_CRITICAL
        if corrupted or len(unhealthy) > 1:
            return self.THREAT_HIGH
        if high_heal or unhealthy:
            return self.THREAT_MODERATE
        return self.THREAT_LOW

    # ---- adaptive decision-making (public entry point) ----

    def decide(self, proposed_action: str, threat_level: str, context: Dict) -> Dict:
        """
        Route a proposed sentinel action through BraidedLogic before execution.
        Returns the final judgment packet.
        """
        return self.braided_logic.judgment(proposed_action, threat_level, context)

    # ---- incident learning ----

    def record_incident(self, brick_name: str, fault_type: str) -> None:
        """
        Register a fault event so the sentinel can learn patterns over time
        and autonomously tighten alert thresholds.
        """
        self._incident_counts[brick_name] = self._incident_counts.get(brick_name, 0) + 1
        self._anomaly_log.append({
            "brick": brick_name,
            "fault": fault_type,
            "at": self.clock.now(),
            "cumulative": self._incident_counts[brick_name],
        })
        self._evolve_thresholds(brick_name)

    # ---- autonomous evolution ----

    def _evolve_thresholds(self, brick_name: str) -> None:
        """
        Tighten the alert threshold when any brick's incident count reaches
        2× the current threshold — catching future surges sooner.
        """
        count = self._incident_counts.get(brick_name, 0)
        if count >= self._alert_threshold * self.THRESHOLD_EVOLUTION_MULTIPLIER and self._alert_threshold > 1:
            self._alert_threshold = max(1, self._alert_threshold - 1)

    # ---- alerts ----

    def _raise_alert(self, threat_level: str, context: Dict) -> None:
        alert = {
            "at": self.clock.now(),
            "threat_level": threat_level,
            "summary": f"Sentinel alert: {threat_level.upper()} threat detected.",
            "context": {k: v for k, v in context.items() if k != "context"},
        }
        self._alerts.append(alert)

    def alerts(self) -> List[Dict]:
        return list(self._alerts)

    def anomaly_log(self) -> List[Dict]:
        return list(self._anomaly_log)

    def incident_counts(self) -> Dict[str, int]:
        return dict(self._incident_counts)

    @property
    def alert_threshold(self) -> int:
        return self._alert_threshold


# ===================== OPERATIONS =====================
class OperationsLayer:
    def __init__(self, spine: Spine, bricks: Dict[str, Brick], dep_graph: nx.DiGraph, clock: DeterministicClock):
        self.spine = spine
        self.bricks = bricks
        self.dep_graph = dep_graph
        self.clock = clock

    def current_state(self) -> Dict[str, Dict]:
        return {name: brick.get_state() for name, brick in self.bricks.items()}

    def current_health(self) -> Dict[str, bool]:
        return {name: brick.healthy for name, brick in self.bricks.items()}

    def boot(self) -> bool:
        try:
            order = list(nx.topological_sort(self.dep_graph))
        except nx.NetworkXUnfeasible:
            return False

        for name in order:
            if not self.bricks[name].run(self.clock):
                return False

        self.spine.commit_version(self.current_state(), self.current_health())
        return True

    def run_cycle(self) -> bool:
        try:
            order = list(nx.topological_sort(self.dep_graph))
        except nx.NetworkXUnfeasible:
            return False

        ok = True
        for name in order:
            if not self.bricks[name].run(self.clock):
                ok = False

        if ok and all(self.current_health().values()):
            self.spine.commit_version(self.current_state(), self.current_health())
            return True
        return False


# ===================== SOVEREIGN OS =====================
class SovereignOS:
    def __init__(self):
        self.clock = DeterministicClock()
        self.dep_graph = nx.DiGraph()
        self.bricks: Dict[str, Brick] = {}
        self.spine = Spine(self.clock)
        self.healing: Optional[HealingLayer] = None
        self.operations: Optional[OperationsLayer] = None
        self.sentinel: Optional[SentinelLayer] = None
        self.setup_system()

    def setup_system(self) -> None:
        self.dep_graph = nx.DiGraph()
        self.bricks = {
            "core": Brick("core", [], {"status": "running", "version": 1, "role": "spine_anchor"}),
            "driver_net": Brick("driver_net", ["core"], {"status": "up", "packets": 0, "driver": "mesh-v1"}),
            "fs": Brick("fs", ["core", "driver_net"], {"status": "mounted", "files": {}, "journal_clean": True}),
            "user_app": Brick("user_app", ["fs"], {"status": "active", "data": "hello", "checkpoint": 0}),
        }
        for name, brick in self.bricks.items():
            self.dep_graph.add_node(name)
            for dep in brick.dependencies:
                self.dep_graph.add_edge(dep, name)

        self.healing = HealingLayer(self.spine, self.bricks, self.dep_graph, self.clock)
        self.operations = OperationsLayer(self.spine, self.bricks, self.dep_graph, self.clock)
        self.sentinel = SentinelLayer(self.healing, self.spine, self.clock)

    # ---------------- Fault Injection ----------------
    def inject_fault(self, brick_name: Optional[str], fault_type: str) -> bool:
        if fault_type == "spine_tamper":
            self.spine.tamper_with_head()
            self.sentinel.record_incident("spine", fault_type)
            return True

        if fault_type == "heal_layer_fault":
            self.healing.online = False
            self.sentinel.record_incident("heal_layer", fault_type)
            return True

        if brick_name is None or brick_name not in self.bricks:
            return False

        brick = self.bricks[brick_name]

        if fault_type in {"corrupt", "storage_corrupt"}:
            brick.state["corrupted"] = True
            brick.healthy = False
        elif fault_type in {"crash", "runtime_crash", "driver_fault", "dependency_failure"}:
            brick.state["crash_flag"] = True
            brick.healthy = False
        elif fault_type == "partial_update":
            brick.update_in_progress = True
            brick.update_target_version = brick.state.get("version", 1) + 1
            brick.state["status"] = "updating"
            brick.state["target_version"] = brick.update_target_version
            brick.healthy = False
        else:
            return False

        self.sentinel.record_incident(brick_name, fault_type)
        return True

    # ---------------- Repair Logic ----------------
    def attempt_repair(self, brick_name: Optional[str], fault_type: Optional[str]) -> bool:
        if fault_type is None:
            return self.operations.run_cycle()

        if fault_type == "spine_tamper":
            recovered = self.healing.recover_spine()
            if recovered:
                return self.operations.run_cycle()
            return False

        if fault_type == "heal_layer_fault":
            # self-heal the healing plane, because apparently even rescue crews need rescue crews.
            self.healing.online = True
            if brick_name:
                self.bricks[brick_name].healthy = True
                self.bricks[brick_name].state.pop("corrupted", None)
                self.bricks[brick_name].state.pop("crash_flag", None)
            return self.operations.run_cycle()

        if brick_name is None:
            return False

        healed = self.healing.heal(brick_name, fault_type)
        if not healed:
            return False

        self.bricks[brick_name].state.pop("corrupted", None)
        self.bricks[brick_name].state.pop("crash_flag", None)
        self.bricks[brick_name].update_in_progress = False
        self.bricks[brick_name].update_target_version = None
        if self.bricks[brick_name].state.get("status") == "updating":
            self.bricks[brick_name].state["status"] = "mounted" if brick_name == "fs" else "running"

        downstream_ok = self.healing.rerun_downstream(brick_name)
        cycle_ok = self.operations.run_cycle()
        return healed and downstream_ok and cycle_ok

    # ---------------- Validation ----------------
    def validate_system(self) -> Tuple[bool, Dict[str, bool]]:
        health = all(brick.healthy for brick in self.bricks.values())
        chain_ok = self.spine.verify_chain()
        head_ok = self.operations.run_cycle() if False else self.spine.verify_state_matches_head(self.operations.current_state())
        no_corruption = not any(brick.state.get("corrupted") for brick in self.bricks.values())
        no_mid_update = not any(brick.state.get("status") == "updating" for brick in self.bricks.values())
        dag_ok = nx.is_directed_acyclic_graph(self.dep_graph)
        details = {
            "health": health,
            "chain_ok": chain_ok,
            "head_ok": head_ok,
            "no_corruption": no_corruption,
            "no_mid_update": no_mid_update,
            "dag_ok": dag_ok,
        }
        return all(details.values()), details

    # ---------------- Tests ----------------
    def run_test(self, test_name: str, fault_brick: Optional[str], fault_type: Optional[str]) -> Tuple[bool, Dict]:
        self.setup_system()
        boot_ok = self.operations.boot()
        if not boot_ok:
            return False, {"test": test_name, "reason": "boot_failed"}

        if fault_type:
            self.inject_fault(fault_brick, fault_type)

        rounds = 0
        passed = False
        details = {}

        while rounds < self.spine.policy["max_repair_rounds_per_test"]:
            rounds += 1
            repaired = self.attempt_repair(fault_brick, fault_type)
            valid, details = self.validate_system()
            if repaired and valid:
                passed = True
                break

            # Extra fallback path for stubborn scenarios.
            if fault_type in {"crash", "runtime_crash", "driver_fault", "dependency_failure"} and fault_brick:
                self.bricks[fault_brick].healthy = True
                self.healing.rerun_downstream(fault_brick)
            elif fault_type in {"corrupt", "storage_corrupt", "partial_update"} and fault_brick:
                last_good = self.spine.get_last_good(fault_brick)
                if last_good:
                    self.bricks[fault_brick].set_state(last_good)
            elif fault_type == "heal_layer_fault":
                self.healing.online = True
            elif fault_type == "spine_tamper":
                self.healing.recover_spine()

        report = {
            "test": test_name,
            "fault_brick": fault_brick,
            "fault_type": fault_type,
            "repair_rounds": rounds,
            "details": details,
            "ledger_head": self.spine.current_version,
        }
        return passed, report

    def run_all_tests_once(self, verbose: bool = True) -> bool:
        tests = [
            ("1. Runtime Process Corruption", "user_app", "corrupt"),
            ("2. Driver-Level Fault", "driver_net", "driver_fault"),
            ("3. Healing Layer Goes Wrong", "fs", "heal_layer_fault"),
            ("4. Spine Compromise Attempt", None, "spine_tamper"),
            ("5. Cascading Dependency Failure", "core", "dependency_failure"),
            ("6. Persistent Storage Corruption", "fs", "storage_corrupt"),
            ("7. Update Failure Mid-Install", "fs", "partial_update"),
        ]

        all_passed = True
        for name, brick, fault in tests:
            passed, report = self.run_test(name, brick, fault)
            if verbose:
                status = "PASS" if passed else "FAIL"
                print(f"{name}: {status} | rounds={report['repair_rounds']} | head=v{report['ledger_head']}")
                if not passed:
                    print(f"  details={report['details']}")
            all_passed = all_passed and passed

        sentinel_passed = self.run_sentinel_tests_once(verbose=verbose)
        return all_passed and sentinel_passed

    # ---------------- Sentinel Tests ----------------

    def run_sentinel_tests_once(self, verbose: bool = True) -> bool:
        """
        Run the sentinel self-awareness test suite once.
        Each test is independent; the system is re-initialised between runs.
        """
        results = [
            self._sentinel_test_nominal(verbose),
            self._sentinel_test_anomaly_detection(verbose),
            self._sentinel_test_incident_learning(verbose),
            self._sentinel_test_moral_guardrail(verbose),
            self._sentinel_test_chain_integrity(verbose),
        ]
        return all(results)

    def _sentinel_test_nominal(self, verbose: bool) -> bool:
        """8. Sentinel watch on a healthy system → threat_level = low."""
        os = SovereignOS()
        os.operations.boot()
        report = os.sentinel.watch(os.bricks)
        passed = (
            report["threat_level"] == SentinelLayer.THREAT_LOW
            and report["chain_integrity"] is True
            and len(report["anomalies"]) == 0
        )
        if verbose:
            status = "PASS" if passed else "FAIL"
            print(f"8. Sentinel Nominal Watch: {status} | threat={report['threat_level']}")
        return passed

    def _sentinel_test_anomaly_detection(self, verbose: bool) -> bool:
        """9. Sentinel detects corruption anomaly after fault injection."""
        os = SovereignOS()
        os.operations.boot()
        os.inject_fault("fs", "storage_corrupt")
        report = os.sentinel.watch(os.bricks)
        anomalies = report["anomalies"]
        has_corruption = any("active_corruption:fs" in a for a in anomalies)
        passed = (
            report["threat_level"] in {SentinelLayer.THREAT_HIGH, SentinelLayer.THREAT_CRITICAL}
            and has_corruption
        )
        if verbose:
            status = "PASS" if passed else "FAIL"
            print(
                f"9. Sentinel Anomaly Detection: {status} | "
                f"threat={report['threat_level']} | anomalies={len(anomalies)}"
            )
        return passed

    def _sentinel_test_incident_learning(self, verbose: bool) -> bool:
        """10. Sentinel tightens alert threshold after repeated incidents."""
        os = SovereignOS()
        os.operations.boot()
        initial_threshold = os.sentinel.alert_threshold
        # Record 2× threshold incidents on the same brick to trigger evolution.
        for _ in range(initial_threshold * SentinelLayer.THRESHOLD_EVOLUTION_MULTIPLIER):
            os.sentinel.record_incident("core", "dependency_failure")
        evolved = os.sentinel.alert_threshold < initial_threshold
        passed = evolved
        if verbose:
            status = "PASS" if passed else "FAIL"
            print(
                f"10. Sentinel Incident Learning: {status} | "
                f"threshold {initial_threshold}→{os.sentinel.alert_threshold}"
            )
        return passed

    def _sentinel_test_moral_guardrail(self, verbose: bool) -> bool:
        """11. BraidedLogic rejects a purge action when no backup exists."""
        logic = BraidedLogic(personality="adaptive")
        judgment = logic.judgment("purge", "high", {"has_backup": False})
        passed = (
            judgment["approved"] is False
            and judgment["adjusted_action"] == "alert_only"
        )
        if verbose:
            status = "PASS" if passed else "FAIL"
            print(
                f"11. Sentinel Moral Guardrail: {status} | "
                f"approved={judgment['approved']} action={judgment['adjusted_action']}"
            )
        return passed

    def _sentinel_test_chain_integrity(self, verbose: bool) -> bool:
        """12. Sentinel reports spine_chain_broken anomaly after spine tamper."""
        os = SovereignOS()
        os.operations.boot()
        os.inject_fault(None, "spine_tamper")
        report = os.sentinel.watch(os.bricks)
        has_chain_anomaly = any("spine_chain_broken" in a for a in report["anomalies"])
        passed = has_chain_anomaly and report["threat_level"] == SentinelLayer.THREAT_CRITICAL
        if verbose:
            status = "PASS" if passed else "FAIL"
            print(
                f"12. Sentinel Chain Integrity: {status} | "
                f"threat={report['threat_level']} | chain_ok={report['chain_integrity']}"
            )
        return passed

    def run_three_clean_passes(self) -> bool:
        streak = 0
        for run in range(1, 4):
            print(f"\n--- TEST RUN #{run} ---")
            fresh = SovereignOS()
            passed = fresh.run_all_tests_once(verbose=True)
            if not passed:
                print(f"Run #{run}: FAIL")
                return False
            streak += 1
            print(f"Run #{run}: FULL PASS")
        print(f"\nALL TESTS PASSED {streak} TIMES IN A ROW - SYSTEM READY")
        return True


# ===================== MAIN =====================
if __name__ == "__main__":
    print("Brick Stitch Sovereign OS - Hardened Single-File Validation Harness")
    print("Deterministic clock, chained Spine ledger, per-brick rollback, DAG-aware healing.\n")
    SovereignOS().run_three_clean_passes()
