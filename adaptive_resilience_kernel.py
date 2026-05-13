#!/usr/bin/env python3
"""
Adaptive Resilience Kernel
Single-file core system.

Run:
    python adaptive_resilience_kernel.py

Optional:
    python adaptive_resilience_kernel.py --nodes 8 --cycles 50 --stress 1.5 --delay 0.05
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


VERSION = "AQRK-CORE-1.0.0"

DEFAULT_VAULT_FILE = Path("recovery_vault.json")
DEFAULT_LEDGER_FILE = Path("resilience_ledger.log")
DEFAULT_REPORT_FILE = Path("resilience_report.json")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def stable_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def sha256(data: Any) -> str:
    return hashlib.sha256(stable_json(data).encode("utf-8")).hexdigest()


class Ledger:
    def __init__(self, path: Path = DEFAULT_LEDGER_FILE):
        self.path = path

    def write(self, message: str) -> None:
        line = f"[{now()}] {message}"
        print(line)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")


@dataclass
class Node:
    name: str
    state: str = "Stable"
    stability: float = 100.0
    phase: float = 0.0
    temp: float = 20.0
    drift: float = 0.0
    cycles: int = 0
    errors: int = 0

    def initialize(self, ledger: Ledger | None = None) -> None:
        self.state = "Stable"
        self.stability = clamp(self.stability + 10.0, 0.0, 100.0)
        self.phase = 0.0

        if ledger:
            ledger.write(f"INIT {self.name} stability={self.stability:.2f}")

    def pulse(self, strength: float, ledger: Ledger | None = None) -> None:
        self.phase = (self.phase + strength) % 360.0
        cost = abs(strength) * random.uniform(0.01, 0.05)
        self.stability = clamp(self.stability - cost, 0.0, 100.0)

        if ledger:
            ledger.write(
                f"PULSE {self.name} strength={strength:.2f} "
                f"stability={self.stability:.2f}"
            )

    def degrade(self, stress: float = 1.0) -> Dict[str, float]:
        self.cycles += 1

        temp_shift = random.uniform(-0.4, 0.7) * stress
        drift_noise = random.uniform(0.0, 2.5) * stress
        control_noise = random.uniform(0.0, 1.5) * stress
        phase_noise = random.uniform(-4.0, 4.0) * stress

        self.temp += temp_shift
        self.drift += drift_noise
        self.phase = (self.phase + phase_noise) % 360.0

        damage = abs(temp_shift) * 4.0 + drift_noise + control_noise
        self.stability = clamp(self.stability - damage, 0.0, 100.0)

        if self.stability < 60.0:
            self.state = "Critical"
            self.errors += 1
        elif self.stability < 75.0:
            self.state = "Warning"
        else:
            self.state = "Stable"

        return {
            "temp_shift": temp_shift,
            "drift_noise": drift_noise,
            "control_noise": control_noise,
            "phase_noise": phase_noise,
            "damage": damage,
        }

    def snapshot(self) -> Dict[str, Any]:
        return asdict(self)

    def restore(self, snapshot: Dict[str, Any]) -> None:
        for key, value in snapshot.items():
            if hasattr(self, key):
                setattr(self, key, value)

        self.state = "Stable"
        self.stability = clamp(float(self.stability), 80.0, 100.0)


class Register:
    def __init__(self, size: int, ledger: Ledger):
        if size < 1:
            raise ValueError("Register size must be at least 1.")

        self.ledger = ledger
        self.nodes: List[Node] = [Node(name=f"Node-{i + 1:02d}") for i in range(size)]

    def initialize(self) -> None:
        self.ledger.write(f"REGISTER initializing {len(self.nodes)} node(s)")
        for node in self.nodes:
            node.initialize(self.ledger)

    def pulse_program(self, cycle: int) -> None:
        for i, node in enumerate(self.nodes):
            if cycle % (5 + i) == 0:
                node.pulse(180.0, self.ledger)
            elif cycle % (3 + i) == 0:
                node.pulse(90.0, self.ledger)

    def degrade_all(self, stress: float) -> List[Dict[str, Any]]:
        reports = []

        for node in self.nodes:
            noise = node.degrade(stress)
            reports.append(
                {
                    "node": node.name,
                    "state": node.state,
                    "stability": node.stability,
                    "noise": noise,
                }
            )

        return reports

    def warning_nodes(self, warning_threshold: float) -> List[Node]:
        return [
            node for node in self.nodes
            if 60.0 <= node.stability < warning_threshold
        ]

    def critical_nodes(self, critical_threshold: float) -> List[Node]:
        return [node for node in self.nodes if node.stability < critical_threshold]

    def average_stability(self) -> float:
        return sum(node.stability for node in self.nodes) / len(self.nodes)

    def min_stability(self) -> float:
        return min(node.stability for node in self.nodes)

    def max_stability(self) -> float:
        return max(node.stability for node in self.nodes)

    def snapshot(self) -> Dict[str, Any]:
        return {
            "size": len(self.nodes),
            "nodes": [node.snapshot() for node in self.nodes],
        }

    def restore(self, snapshot: Dict[str, Any]) -> None:
        incoming = snapshot.get("nodes", [])

        if len(incoming) != len(self.nodes):
            raise ValueError("Snapshot size does not match register size.")

        for node, saved in zip(self.nodes, incoming):
            node.restore(saved)


class RecoveryVault:
    def __init__(self, path: Path, ledger: Ledger):
        self.path = path
        self.ledger = ledger

    def create_snapshot(self, register: Register) -> Dict[str, Any]:
        payload = {
            "version": VERSION,
            "created_at": now(),
            "register": register.snapshot(),
        }

        return {
            "hash": sha256(payload),
            "payload": payload,
        }

    def save(self, register: Register) -> None:
        package = self.create_snapshot(register)
        self.path.write_text(json.dumps(package, indent=2), encoding="utf-8")
        self.ledger.write(f"VAULT saved snapshot hash={package['hash'][:16]}")

    def load(self) -> Dict[str, Any]:
        if not self.path.exists():
            raise FileNotFoundError("Recovery vault does not exist.")

        package = json.loads(self.path.read_text(encoding="utf-8"))

        if "hash" not in package or "payload" not in package:
            raise ValueError("Recovery vault is malformed.")

        expected = package["hash"]
        actual = sha256(package["payload"])

        if expected != actual:
            raise ValueError("Recovery vault hash verification failed.")

        return package


class ResilienceKernel:
    def __init__(
        self,
        register: Register,
        vault: RecoveryVault,
        ledger: Ledger,
        critical_threshold: float = 60.0,
        warning_threshold: float = 75.0,
        save_threshold: float = 92.0,
        stress: float = 1.0,
    ):
        self.register = register
        self.vault = vault
        self.ledger = ledger
        self.critical_threshold = critical_threshold
        self.warning_threshold = warning_threshold
        self.save_threshold = save_threshold
        self.stress = stress

        self.cycles = 0
        self.warning_refreshes = 0
        self.restores = 0
        self.blocked_restores = 0
        self.emergency_refreshes = 0

    def boot(self) -> None:
        self.ledger.write(f"KERNEL boot version={VERSION}")
        self.register.initialize()
        self.vault.save(self.register)
        self.ledger.write("KERNEL online")

    def refresh_warnings(self) -> None:
        for node in self.register.warning_nodes(self.warning_threshold):
            self.warning_refreshes += 1
            self.ledger.write(
                f"WARNING_REFRESH {node.name} stability={node.stability:.2f}"
            )
            node.initialize(self.ledger)

    def restore_critical(self) -> None:
        critical = self.register.critical_nodes(self.critical_threshold)

        if not critical:
            if self.register.average_stability() >= self.save_threshold:
                self.vault.save(self.register)
            return

        self.ledger.write(f"CRITICAL detected count={len(critical)}")

        try:
            package = self.vault.load()
            snapshot = package["payload"]["register"]
            self.register.restore(snapshot)
            self.restores += 1
            self.ledger.write(f"RESTORE complete hash={package['hash'][:16]}")

        except Exception as exc:
            self.blocked_restores += 1
            self.ledger.write(f"RESTORE_BLOCKED reason={exc}")
            self.ledger.write("EMERGENCY_REFRESH critical nodes only")

            for node in critical:
                self.emergency_refreshes += 1
                node.initialize(self.ledger)
                node.stability = clamp(node.stability + 20.0, 0.0, 100.0)

    def cycle(self) -> None:
        self.cycles += 1
        self.ledger.write(f"CYCLE start {self.cycles}")

        self.register.pulse_program(self.cycles)
        reports = self.register.degrade_all(self.stress)

        for report in reports:
            self.ledger.write(
                f"STATE {report['node']} {report['state']} "
                f"stability={report['stability']:.2f}"
            )

        self.refresh_warnings()
        self.restore_critical()

        self.ledger.write(
            f"CYCLE end {self.cycles} "
            f"avg={self.register.average_stability():.2f} "
            f"min={self.register.min_stability():.2f} "
            f"max={self.register.max_stability():.2f}"
        )

    def report(self) -> Dict[str, Any]:
        return {
            "version": VERSION,
            "cycles": self.cycles,
            "nodes": len(self.register.nodes),
            "average_stability": self.register.average_stability(),
            "min_stability": self.register.min_stability(),
            "max_stability": self.register.max_stability(),
            "warning_refreshes": self.warning_refreshes,
            "restores": self.restores,
            "blocked_restores": self.blocked_restores,
            "emergency_refreshes": self.emergency_refreshes,
            "final_snapshot": self.register.snapshot(),
        }

    def save_report(self, path: Path = DEFAULT_REPORT_FILE) -> None:
        path.write_text(json.dumps(self.report(), indent=2), encoding="utf-8")
        self.ledger.write(f"REPORT saved {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Adaptive Resilience Kernel")
    parser.add_argument("--nodes", type=int, default=4)
    parser.add_argument("--cycles", type=int, default=20)
    parser.add_argument("--stress", type=float, default=1.0)
    parser.add_argument("--delay", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=None)

    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    ledger = Ledger(DEFAULT_LEDGER_FILE)
    register = Register(args.nodes, ledger)
    vault = RecoveryVault(DEFAULT_VAULT_FILE, ledger)

    kernel = ResilienceKernel(
        register=register,
        vault=vault,
        ledger=ledger,
        stress=args.stress,
    )

    kernel.boot()

    for _ in range(args.cycles):
        kernel.cycle()
        if args.delay > 0:
            time.sleep(args.delay)

    kernel.save_report()

    print("\nFINAL REPORT")
    print(json.dumps(kernel.report(), indent=2))


if __name__ == "__main__":
    main()
