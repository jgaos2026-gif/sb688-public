from __future__ import annotations

import csv
import hashlib
import io
import json
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any


class LedgerStore:
    def __init__(self) -> None:
        self._entries: list[dict[str, Any]] = []

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    @staticmethod
    def _entry_digest(entry: dict[str, Any]) -> str:
        payload = {k: v for k, v in entry.items() if k != "entry_hash"}
        return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()

    def append(self, event: dict[str, Any]) -> str:
        entry = deepcopy(event)
        entry.setdefault("id", str(uuid.uuid4()))
        entry.setdefault("timestamp", self._now())
        entry.setdefault("phase", "UNKNOWN")
        entry.setdefault("event_type", "UNSPECIFIED")
        entry.setdefault("health", 0.0)
        entry.setdefault("braid_status", "RED")
        entry.setdefault("message", "")
        entry.setdefault("data", {})
        entry["previous_hash"] = self._entries[-1]["entry_hash"] if self._entries else "GENESIS"
        entry["entry_hash"] = self._entry_digest(entry)
        self._entries.append(entry)
        return entry["id"]

    def get_all(self) -> list[dict[str, Any]]:
        return deepcopy(self._entries)

    def verify_chain(self) -> bool:
        prev = "GENESIS"
        for entry in self._entries:
            if entry.get("previous_hash") != prev:
                return False
            if entry.get("entry_hash") != self._entry_digest(entry):
                return False
            prev = entry["entry_hash"]
        return True

    def get_checkpoint(self, timestamp: str) -> dict[str, Any] | None:
        checkpoint = None
        for entry in self._entries:
            if entry["timestamp"] <= timestamp and entry.get("event_type") == "CHECKPOINT_SAVED":
                checkpoint = deepcopy(entry.get("data", {}).get("checkpoint"))
        return checkpoint

    def export_json(self) -> str:
        return json.dumps(self._entries, indent=2, sort_keys=True)

    def export_csv(self) -> str:
        if not self._entries:
            return ""
        columns = ["id", "timestamp", "phase", "event_type", "health", "braid_status", "message", "previous_hash", "entry_hash", "data"]
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=columns)
        writer.writeheader()
        for entry in self._entries:
            row = {**entry, "data": json.dumps(entry.get("data", {}), sort_keys=True)}
            writer.writerow({k: row.get(k, "") for k in columns})
        return buf.getvalue()

    def checksum(self) -> str:
        return hashlib.sha256(self.export_json().encode("utf-8")).hexdigest()
