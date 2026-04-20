from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "sb688_lock_gate.py"


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        text=True,
        capture_output=True,
        check=False,
    )


def test_lock_creates_vault_state(tmp_path: Path) -> None:
    root = tmp_path / "root"
    vault = tmp_path / ".sb688_locked"
    root.mkdir()

    proc = _run("lock", "--root", str(root), "--vault", str(vault), "--code", "1211")

    assert proc.returncode == 0, proc.stderr
    assert "Vault locked." in proc.stdout
    state_path = vault / "lock_gate_state.json"
    assert state_path.exists()
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert state["locked"] is True
    assert state["root"] == str(root.resolve())


def test_lock_is_idempotent_with_same_code(tmp_path: Path) -> None:
    root = tmp_path / "root"
    vault = tmp_path / ".sb688_locked"
    root.mkdir()

    first = _run("lock", "--root", str(root), "--vault", str(vault), "--code", "1211")
    second = _run("lock", "--root", str(root), "--vault", str(vault), "--code", "1211")

    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    assert "Vault already locked." in second.stdout


def test_unlock_requires_correct_code(tmp_path: Path) -> None:
    root = tmp_path / "root"
    vault = tmp_path / ".sb688_locked"
    root.mkdir()
    assert _run("lock", "--root", str(root), "--vault", str(vault), "--code", "1211").returncode == 0

    bad = _run("unlock", "--vault", str(vault), "--code", "9999")
    good = _run("unlock", "--vault", str(vault), "--code", "1211")

    assert bad.returncode == 1
    assert "Invalid code." in bad.stderr
    assert good.returncode == 0, good.stderr
    assert "Vault unlocked." in good.stdout
