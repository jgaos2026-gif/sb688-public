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


# ===================== SENTINEL MONITOR =====================
class SentinelMonitor:
    """
    Autonomous self-awareness watchdog for the Brick Stitch Sovereign OS.

    Tracks fault/repair events across bricks, builds a tamper-evident
    hash chain of observations, detects repeat offenders, and emits
    adaptive healing strategy recommendations that escalate as a brick
    accumulates unresolved faults.

    Strategies (ascending severity):
        standard       — use the normal HealingLayer path
        deep_restart   — standard healing + force-restart of all downstream
        force_rollback — bypass HealingLayer; restore directly from spine snapshot
    """

    ESCALATION_THRESHOLD: int = 3   # faults in window before force_rollback
    WINDOW_SIZE: int = 10           # sliding observation window

    def __init__(self, clock: DeterministicClock) -> None:
        self.clock = clock
        self._records: List[Dict] = []
        self._chain_hash: str = "SENTINEL_GENESIS"

    # ---- public API ----

    def observe(
        self,
        brick_name: str,
        fault_type: str,
        healed: bool,
        strategy: str = "standard",
    ) -> None:
        """Record a fault/repair event and advance the tamper-evident chain."""
        record: Dict = {
            "brick": brick_name,
            "fault": fault_type,
            "healed": healed,
            "strategy": strategy,
            "t": self.clock.now(),
            "prev_hash": self._chain_hash,
        }
        self._chain_hash = hash_blob(stable_json(record))
        self._records.append(record)

    def suggest_strategy(self, brick_name: str, fault_type: str) -> str:  # noqa: ARG002
        """
        Return an adaptive healing strategy for *brick_name* based on its
        observed fault history within the current sliding window.
        """
        brick_records = self._window(brick_name)
        fault_count = len(brick_records)
        unhealed_count = sum(1 for r in brick_records if not r["healed"])

        if unhealed_count >= 2 or fault_count >= self.ESCALATION_THRESHOLD:
            return "force_rollback"
        if fault_count >= 2:
            return "deep_restart"
        return "standard"

    def diagnose(self) -> Dict:
        """
        Analyse the current observation window and return an anomaly report
        that includes per-brick fault counts, repeat offenders, and the
        result of the self-integrity chain verification.
        """
        window = self._window()
        by_brick: Dict[str, Dict] = {}
        for record in window:
            entry = by_brick.setdefault(
                record["brick"],
                {"faults": 0, "unhealed": 0, "strategies": []},
            )
            entry["faults"] += 1
            if not record["healed"]:
                entry["unhealed"] += 1
            entry["strategies"].append(record["strategy"])

        repeat_offenders = [
            brick
            for brick, data in by_brick.items()
            if data["faults"] >= self.ESCALATION_THRESHOLD
        ]
        return {
            "by_brick": by_brick,
            "repeat_offenders": repeat_offenders,
            "chain_integrity": self.self_check(),
            "total_observations": len(window),
            "window_size": self.WINDOW_SIZE,
        }

    def self_check(self) -> bool:
        """Replay the hash chain; return True when the record log is intact."""
        return self._verify_chain()

    # ---- private ----

    def _window(self, brick_name: Optional[str] = None) -> List[Dict]:
        window = self._records[-self.WINDOW_SIZE:]
        if brick_name is not None:
            return [r for r in window if r["brick"] == brick_name]
        return window

    def _verify_chain(self) -> bool:
        current_hash = "SENTINEL_GENESIS"
        for record in self._records:
            if record.get("prev_hash") != current_hash:
                return False
            current_hash = hash_blob(stable_json(record))
        return current_hash == self._chain_hash



class SovereignOS:
    def __init__(self):
        self.clock = DeterministicClock()
        self.dep_graph = nx.DiGraph()
        self.bricks: Dict[str, Brick] = {}
        self.spine = Spine(self.clock)
        self.healing: Optional[HealingLayer] = None
        self.operations: Optional[OperationsLayer] = None
        # Sentinel persists across setup_system() calls so it accumulates
        # knowledge across the full test suite run.
        self.sentinel = SentinelMonitor(self.clock)
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

    # ---------------- Fault Injection ----------------
    def inject_fault(self, brick_name: Optional[str], fault_type: str) -> bool:
        if fault_type == "spine_tamper":
            self.spine.tamper_with_head()
            return True

        if fault_type == "heal_layer_fault":
            self.healing.online = False
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
        return True

    # ---------------- Repair Logic ----------------
    def attempt_repair(self, brick_name: Optional[str], fault_type: Optional[str]) -> bool:
        if fault_type is None:
            return self.operations.run_cycle()

        if fault_type == "spine_tamper":
            recovered = self.healing.recover_spine()
            ok = self.operations.run_cycle() if recovered else False
            self.sentinel.observe("spine", "spine_tamper", ok, "system")
            return ok

        if fault_type == "heal_layer_fault":
            # self-heal the healing plane, because apparently even rescue crews need rescue crews.
            self.healing.online = True
            if brick_name:
                self.bricks[brick_name].healthy = True
                self.bricks[brick_name].state.pop("corrupted", None)
                self.bricks[brick_name].state.pop("crash_flag", None)
            ok = self.operations.run_cycle()
            self.sentinel.observe(brick_name or "system", "heal_layer_fault", ok, "system")
            return ok

        if brick_name is None:
            return False

        # Consult sentinel for an adaptive healing strategy based on history.
        strategy = self.sentinel.suggest_strategy(brick_name, fault_type)

        if strategy == "force_rollback":
            last_good = self.spine.get_last_good(brick_name)
            if last_good:
                self.bricks[brick_name].set_state(last_good)
                self.bricks[brick_name].state.pop("corrupted", None)
                self.bricks[brick_name].state.pop("crash_flag", None)
                if self.bricks[brick_name].state.get("status") == "updating":
                    self.bricks[brick_name].state["status"] = (
                        "mounted" if brick_name == "fs" else "running"
                    )
                downstream_ok = self.healing.rerun_downstream(brick_name)
                ok = self.operations.run_cycle() if downstream_ok else False
                self.sentinel.observe(brick_name, fault_type, ok, strategy)
                return ok
            # Fall through to standard path if no snapshot is available.

        healed = self.healing.heal(brick_name, fault_type)
        if not healed:
            self.sentinel.observe(brick_name, fault_type, False, strategy)
            return False

        self.bricks[brick_name].state.pop("corrupted", None)
        self.bricks[brick_name].state.pop("crash_flag", None)
        self.bricks[brick_name].update_in_progress = False
        self.bricks[brick_name].update_target_version = None
        if self.bricks[brick_name].state.get("status") == "updating":
            self.bricks[brick_name].state["status"] = "mounted" if brick_name == "fs" else "running"

        if strategy == "deep_restart":
            # Force-restart all downstream bricks before re-running them.
            for name in nx.descendants(self.dep_graph, brick_name):
                self.bricks[name].healthy = True
                self.bricks[name].state.pop("crash_flag", None)

        downstream_ok = self.healing.rerun_downstream(brick_name)
        cycle_ok = self.operations.run_cycle()
        ok = healed and downstream_ok and cycle_ok
        self.sentinel.observe(brick_name, fault_type, ok, strategy)
        return ok

    # ---------------- Validation ----------------
    def validate_system(self) -> Tuple[bool, Dict[str, bool]]:
        health = all(brick.healthy for brick in self.bricks.values())
        chain_ok = self.spine.verify_chain()
        head_ok = self.operations.run_cycle() if False else self.spine.verify_state_matches_head(self.operations.current_state())
        no_corruption = not any(brick.state.get("corrupted") for brick in self.bricks.values())
        no_mid_update = not any(brick.state.get("status") == "updating" for brick in self.bricks.values())
        dag_ok = nx.is_directed_acyclic_graph(self.dep_graph)
        sentinel_ok = self.sentinel.self_check()
        details = {
            "health": health,
            "chain_ok": chain_ok,
            "head_ok": head_ok,
            "no_corruption": no_corruption,
            "no_mid_update": no_mid_update,
            "dag_ok": dag_ok,
            "sentinel_ok": sentinel_ok,
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
            ("8. Sentinel Self-Awareness Validation", None, None),
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

        if verbose:
            diagnosis = self.sentinel.diagnose()
            repeat = diagnosis["repeat_offenders"] or "none"
            print(
                f"\n[SENTINEL] observations={diagnosis['total_observations']} | "
                f"repeat_offenders={repeat} | "
                f"chain_intact={diagnosis['chain_integrity']}"
            )
        return all_passed

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
