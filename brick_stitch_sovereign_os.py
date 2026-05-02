import hashlib
import json
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

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
        self.sentinel = SentinelLayer(self.healing, self.bricks, self.clock)

    # ---------------- Fault Injection ----------------
    def inject_fault(self, brick_name: Optional[str], fault_type: str) -> bool:
        if fault_type == "spine_tamper":
            self.spine.tamper_with_head()
            self.sentinel.record_fault(brick_name, fault_type)
            return True

        if fault_type == "heal_layer_fault":
            self.healing.online = False
            self.sentinel.record_fault(brick_name, fault_type)
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

        self.sentinel.record_fault(brick_name, fault_type)
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
        details: Dict[str, Any] = {}

        while rounds < self.spine.policy["max_repair_rounds_per_test"]:
            rounds += 1
            repaired = self.attempt_repair(fault_brick, fault_type)
            valid, details = self.validate_system()
            # Run sentinel watch after each repair attempt.
            self.sentinel.watch()
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
            "sentinel": self.sentinel.status(),
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
            ("8. Sentinel Watches Crash Fault", "user_app", "runtime_crash"),
            ("9. Sentinel Watches Spine Tamper", None, "spine_tamper"),
            ("10. Sentinel Adaptive Threshold", "driver_net", "corrupt"),
        ]

        all_passed = True
        for name, brick, fault in tests:
            passed, report = self.run_test(name, brick, fault)
            if verbose:
                status = "PASS" if passed else "FAIL"
                sentinel_info = report.get("sentinel", {})
                threat = sentinel_info.get("threat_level", "n/a")
                print(
                    f"{name}: {status} | rounds={report['repair_rounds']} "
                    f"| head=v{report['ledger_head']} | sentinel={threat}"
                )
                if not passed:
                    print(f"  details={report['details']}")
            all_passed = all_passed and passed
        return all_passed

    def sentinel_status(self) -> Dict[str, Any]:
        """Return the current sentinel status dict."""
        return self.sentinel.status() if self.sentinel else {}

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


# ===================== BRAIDED LOGIC =====================
class BraidedLogic:
    """Three-braid ethical decision layer (personality · moral · judgment).

    Every sentinel action passes through moral and judgment checks before
    being approved.  Personalities tune the threshold but cannot bypass
    the hard safety floor.
    """

    PERSONALITIES = ("steadfast", "adaptive", "cautious")

    # Actions that require a confirmed backup before being permitted.
    _DESTRUCTIVE_ACTIONS: frozenset = frozenset({"purge", "wipe", "overwrite_ledger"})

    def __init__(self, personality: str = "adaptive"):
        if personality not in self.PERSONALITIES:
            personality = "adaptive"
        self.personality = personality
        self.decision_log: List[Dict[str, Any]] = []

    # ---- moral braid ----
    def moral_check(self, action: str, context: Dict[str, Any]) -> bool:
        """Return True when the action is morally permissible."""
        if action in self._DESTRUCTIVE_ACTIONS:
            if not context.get("backup_confirmed"):
                return False
        return True

    # ---- judgment braid ----
    def judgment_route(self, threat_level: str, suggested_action: str) -> str:
        """Map threat level + personality to a concrete approved action."""
        if self.personality == "cautious":
            if threat_level in {"high", "critical"}:
                return "alert_only"
        if self.personality == "steadfast":
            return suggested_action
        # adaptive: follow suggestion unless threat is merely low
        if threat_level == "low":
            return "monitor"
        return suggested_action

    # ---- unified entry point ----
    def evaluate(self, action: str, threat_level: str, context: Dict[str, Any]) -> Dict[str, Any]:
        moral_ok = self.moral_check(action, context)
        routed = self.judgment_route(threat_level, action) if moral_ok else "blocked"
        entry: Dict[str, Any] = {
            "action": action,
            "threat_level": threat_level,
            "moral_ok": moral_ok,
            "routed_to": routed,
            "personality": self.personality,
        }
        self.decision_log.append(entry)
        return entry


# ===================== SENTINEL =====================
class SentinelLayer:
    """Vigilance plane above the HealingLayer.

    Watches brick health over time, classifies threats, learns from
    incidents, and tightens its own detection thresholds autonomously.
    All actions pass through BraidedLogic before being applied.
    """

    THREAT_LEVELS = ("nominal", "low", "moderate", "high", "critical")

    def __init__(
        self,
        healing: "HealingLayer",
        bricks: Dict[str, Brick],
        clock: DeterministicClock,
        personality: str = "adaptive",
    ):
        self.healing = healing
        self.bricks = bricks
        self.clock = clock
        self.braid = BraidedLogic(personality)
        self.incidents: List[Dict[str, Any]] = []
        self.threat_level: str = "nominal"
        # Threshold: how many consecutive unhealthy bricks trigger an escalation.
        self._escalation_threshold: int = 2
        self._heal_surge_threshold: int = 3  # heals per brick before raising alert
        self._watch_log: List[Dict[str, Any]] = []

    # ---- internal helpers ----
    def _timestamp(self) -> int:
        return self.clock.now()

    def _classify_threat(self, unhealthy_count: int, heal_surges: int) -> str:
        if unhealthy_count == 0 and heal_surges == 0:
            return "nominal"
        if unhealthy_count >= 3 or heal_surges >= self._heal_surge_threshold + 2:
            return "critical"
        if unhealthy_count >= 2 or heal_surges >= self._heal_surge_threshold + 1:
            return "high"
        if unhealthy_count >= 1 or heal_surges >= self._heal_surge_threshold:
            return "moderate"
        return "low"

    # ---- public API ----
    def watch(self) -> Dict[str, Any]:
        """Perform one sentinel watch cycle and return a report."""
        unhealthy = [name for name, b in self.bricks.items() if not b.healthy]
        heal_surges = sum(
            1 for b in self.bricks.values() if b.heal_count >= self._heal_surge_threshold
        )
        chain_broken = not self.healing.spine.verify_chain()

        # Escalate threat classification.
        new_level = self._classify_threat(len(unhealthy), heal_surges)
        if chain_broken and new_level not in {"high", "critical"}:
            new_level = "high"
        self.threat_level = new_level

        report: Dict[str, Any] = {
            "timestamp": self._timestamp(),
            "threat_level": self.threat_level,
            "unhealthy_bricks": unhealthy,
            "heal_surges": heal_surges,
            "chain_broken": chain_broken,
        }

        if self.threat_level not in {"nominal", "low"}:
            decision = self.braid.evaluate(
                action="alert_and_monitor",
                threat_level=self.threat_level,
                context={"backup_confirmed": True},
            )
            report["braid_decision"] = decision
            self._record_incident(report)

        self._watch_log.append(report)
        return report

    def _record_incident(self, report: Dict[str, Any]) -> None:
        incident = deepcopy(report)
        incident["incident_id"] = len(self.incidents) + 1
        self.incidents.append(incident)
        # Autonomous threshold tightening: if incidents pile up, tighten early.
        if len(self.incidents) > self._escalation_threshold * 2:
            self._escalation_threshold = max(1, self._escalation_threshold - 1)

    def record_fault(self, brick_name: Optional[str], fault_type: str) -> None:
        """External hook so SovereignOS can notify sentinel of injected faults."""
        self._watch_log.append({
            "timestamp": self._timestamp(),
            "event": "fault_injected",
            "brick": brick_name,
            "fault_type": fault_type,
        })

    def status(self) -> Dict[str, Any]:
        return {
            "threat_level": self.threat_level,
            "total_incidents": len(self.incidents),
            "escalation_threshold": self._escalation_threshold,
            "heal_surge_threshold": self._heal_surge_threshold,
            "braid_personality": self.braid.personality,
            "watch_cycles": len(self._watch_log),
        }


# ===================== MAIN =====================
if __name__ == "__main__":
    print("Brick Stitch Sovereign OS - Hardened Single-File Validation Harness")
    print("Deterministic clock, chained Spine ledger, per-brick rollback, DAG-aware healing.\n")
    SovereignOS().run_three_clean_passes()
