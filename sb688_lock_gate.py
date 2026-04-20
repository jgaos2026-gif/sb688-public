from __future__ import annotations

import argparse
import hashlib
import json
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path


STATE_FILE = "lock_gate_state.json"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _state_path(vault: Path) -> Path:
    return vault / STATE_FILE


def _load_state(vault: Path) -> dict | None:
    path = _state_path(vault)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _save_state(vault: Path, state: dict) -> None:
    vault.mkdir(parents=True, exist_ok=True)
    _state_path(vault).write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def _resolve_root(root: str) -> Path:
    root_path = Path(root).resolve()
    if not root_path.exists():
        raise ValueError(f"Root path does not exist: {root}")
    if not root_path.is_dir():
        raise ValueError(f"Root path must be a directory: {root}")
    return root_path


def lock(root: str, vault: str, code: str) -> str:
    if not code:
        raise ValueError("Code cannot be empty.")
    root_path = _resolve_root(root)
    vault_path = Path(vault).resolve()

    existing = _load_state(vault_path)
    code_hash = _hash_code(code)
    if existing and existing.get("locked"):
        if not secrets.compare_digest(existing.get("code_hash", ""), code_hash):
            raise ValueError("Vault is already locked with a different code.")
        return "Vault already locked."

    state = {
        "version": 1,
        "locked": True,
        "root": str(root_path),
        "vault": str(vault_path),
        "code_hash": code_hash,
        "updated_at": _now(),
    }
    _save_state(vault_path, state)
    return "Vault locked."


def unlock(vault: str, code: str) -> str:
    if not code:
        raise ValueError("Code cannot be empty.")
    vault_path = Path(vault).resolve()
    state = _load_state(vault_path)
    if not state:
        raise ValueError("Vault is not initialized.")
    if not state.get("locked"):
        return "Vault already unlocked."
    if not secrets.compare_digest(state.get("code_hash", ""), _hash_code(code)):
        raise ValueError("Invalid code.")
    state["locked"] = False
    state["updated_at"] = _now()
    _save_state(vault_path, state)
    return "Vault unlocked."


def status(vault: str) -> str:
    vault_path = Path(vault).resolve()
    state = _load_state(vault_path)
    if not state:
        return json.dumps({"initialized": False, "locked": False})
    payload = {
        "initialized": True,
        "locked": bool(state.get("locked", False)),
        "root": state.get("root"),
        "vault": state.get("vault", str(vault_path)),
        "updated_at": state.get("updated_at"),
    }
    return json.dumps(payload)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="SB688 lock gate utility.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    lock_parser = subparsers.add_parser("lock", help="Lock vault access.")
    lock_parser.add_argument("--root", required=True, help="Root directory to protect.")
    lock_parser.add_argument("--vault", required=True, help="Vault directory for lock state.")
    lock_parser.add_argument("--code", required=True, help="Lock code.")

    unlock_parser = subparsers.add_parser("unlock", help="Unlock vault access.")
    unlock_parser.add_argument("--vault", required=True, help="Vault directory for lock state.")
    unlock_parser.add_argument("--code", required=True, help="Lock code.")

    status_parser = subparsers.add_parser("status", help="Show lock status.")
    status_parser.add_argument("--vault", required=True, help="Vault directory for lock state.")

    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "lock":
            print(lock(args.root, args.vault, args.code))
        elif args.command == "unlock":
            print(unlock(args.vault, args.code))
        else:
            print(status(args.vault))
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
