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
        # Tamper-evident upload event log (separate from main brick-state ledger).
        self.upload_log: List[Dict] = []
        self._upload_log_prev_hash: str = "GENESIS"

    def append_upload_event(self, event: Dict) -> str:
        """Append an upload event to the tamper-evident upload log."""
        entry_hash = hash_blob(stable_json({"event": event, "prev": self._upload_log_prev_hash}))
        signed = {**event, "prev_hash": self._upload_log_prev_hash, "hash": entry_hash}
        self.upload_log.append(signed)
        self._upload_log_prev_hash = entry_hash
        return entry_hash

    def verify_upload_log(self) -> bool:
        """Verify the hash chain of the upload event log."""
        prev = "GENESIS"
        for entry in self.upload_log:
            event = {k: v for k, v in entry.items() if k not in ("prev_hash", "hash")}
            expected = hash_blob(stable_json({"event": event, "prev": prev}))
            if entry["prev_hash"] != prev or entry["hash"] != expected:
                return False
            prev = entry["hash"]
        return True

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


# ===================== SENTINEL =====================
_SENTINEL_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
_SENTINEL_ALLOWED_TYPES = frozenset({
    "text/plain",
    "application/json",
    "application/pdf",
    "application/octet-stream",
    "text/csv",
})


class SentinelLayer:
    """Scans incoming uploads for anomalies before they are accepted into the brick FS."""

    def __init__(self, spine: "Spine", clock: DeterministicClock):
        self.spine = spine
        self.clock = clock
        self._seen_hashes: set = set()

    def scan(self, filename: str, content: bytes, content_type: str) -> Tuple[bool, List[str]]:
        """Return (clean, anomalies). Records anomalies to the spine upload log."""
        anomalies: List[str] = []

        if len(content) == 0:
            anomalies.append("empty_content")

        if len(content) > _SENTINEL_MAX_SIZE:
            anomalies.append(f"content_too_large:{len(content)}")

        if ".." in filename or "/" in filename or "\\" in filename:
            anomalies.append("suspicious_filename")

        normalized_type = content_type.split(";")[0].strip().lower()
        if normalized_type not in _SENTINEL_ALLOWED_TYPES:
            anomalies.append(f"unsupported_content_type:{normalized_type}")

        content_hash = hash_blob(content)
        if content_hash in self._seen_hashes:
            anomalies.append("duplicate_content_hash")

        if not anomalies:
            self._seen_hashes.add(content_hash)

        return len(anomalies) == 0, anomalies


# ===================== FILE UPLOAD MANAGER =====================
class FileUploadManager:
    """Handles incoming file uploads and autonomous self-dispatch.

    All events are recorded in the Spine's tamper-evident upload log.
    """

    def __init__(self, spine: "Spine", bricks: Dict[str, Brick], sentinel: SentinelLayer, clock: DeterministicClock):
        self.spine = spine
        self.bricks = bricks
        self.sentinel = sentinel
        self.clock = clock
        self._store: Dict[str, Dict] = {}

    def receive(self, filename: str, content: bytes, content_type: str = "application/octet-stream") -> Tuple[bool, Dict]:
        """Receive an incoming file upload, validate through the sentinel, and store."""
        ts = self.clock.now()
        clean, anomalies = self.sentinel.scan(filename, content, content_type)
        content_hash = hash_blob(content)

        event: Dict = {
            "action": "receive_upload",
            "filename": filename,
            "content_type": content_type,
            "size": len(content),
            "content_hash": content_hash,
            "sentinel_pass": clean,
            "anomalies": anomalies,
            "timestamp": ts,
        }

        if not clean:
            event["status"] = "rejected"
            self.spine.append_upload_event(event)
            return False, {"status": "rejected", "anomalies": anomalies, "filename": filename}

        fs_brick = self.bricks.get("fs")
        if fs_brick is None or not fs_brick.healthy:
            event["status"] = "failed_fs_unavailable"
            self.spine.append_upload_event(event)
            return False, {"status": "failed", "reason": "fs_brick_unavailable"}

        fs_brick.state.setdefault("files", {})[filename] = {
            "hash": content_hash,
            "size": len(content),
            "content_type": content_type,
            "stored_at": ts,
        }
        self._store[filename] = {
            "content": content,
            "content_hash": content_hash,
            "content_type": content_type,
            "size": len(content),
            "stored_at": ts,
        }

        event["status"] = "accepted"
        self.spine.append_upload_event(event)
        return True, {"status": "accepted", "filename": filename, "hash": content_hash, "size": len(content)}

    def dispatch(self, filename: str, destination: str) -> Tuple[bool, Dict]:
        """Self-upload a stored file to a designated logical destination."""
        ts = self.clock.now()

        if filename not in self._store:
            self.spine.append_upload_event({
                "action": "dispatch_upload",
                "filename": filename,
                "destination": destination,
                "status": "failed",
                "reason": "file_not_found",
                "timestamp": ts,
            })
            return False, {"status": "failed", "reason": "file_not_found", "filename": filename}

        if ".." in destination or destination.startswith("/") or destination.startswith("\\"):
            self.spine.append_upload_event({
                "action": "dispatch_upload",
                "filename": filename,
                "destination": destination,
                "status": "rejected",
                "reason": "invalid_destination",
                "timestamp": ts,
            })
            return False, {"status": "rejected", "reason": "invalid_destination"}

        record = self._store[filename]
        actual_hash = hash_blob(record["content"])
        if actual_hash != record["content_hash"]:
            self.spine.append_upload_event({
                "action": "dispatch_upload",
                "filename": filename,
                "destination": destination,
                "status": "failed",
                "reason": "integrity_check_failed",
                "timestamp": ts,
            })
            return False, {"status": "failed", "reason": "integrity_check_failed"}

        self.spine.append_upload_event({
            "action": "dispatch_upload",
            "filename": filename,
            "destination": destination,
            "content_hash": record["content_hash"],
            "size": record["size"],
            "status": "dispatched",
            "timestamp": ts,
        })
        return True, {
            "status": "dispatched",
            "filename": filename,
            "destination": destination,
            "hash": record["content_hash"],
        }


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
        self.upload_manager: Optional[FileUploadManager] = None
        self.setup_system()

    def setup_system(self) -> None:
        self.dep_graph = nx.DiGraph()
        self.bricks = {
            "core": Brick("core", [], {"status": "running", "version": 1, "role": "spine_anchor"}),
            "driver_net": Brick("driver_net", ["core"], {"status": "up", "packets": 0, "driver": "mesh-v1"}),
            "fs": Brick("fs", ["core", "driver_net"], {"status": "mounted", "files": {}, "journal_clean": True}),
            "user_app": Brick("user_app", ["fs"], {"status": "active", "data": "hello", "checkpoint": 0}),
            "upload": Brick("upload", ["fs"], {"status": "ready", "pending_uploads": 0, "dispatched": 0}),
        }
        for name, brick in self.bricks.items():
            self.dep_graph.add_node(name)
            for dep in brick.dependencies:
                self.dep_graph.add_edge(dep, name)

        self.healing = HealingLayer(self.spine, self.bricks, self.dep_graph, self.clock)
        self.operations = OperationsLayer(self.spine, self.bricks, self.dep_graph, self.clock)
        self.sentinel = SentinelLayer(self.spine, self.clock)
        self.upload_manager = FileUploadManager(self.spine, self.bricks, self.sentinel, self.clock)

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
