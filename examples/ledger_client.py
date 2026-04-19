"""Append-only ledger client example using local JSONL storage."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional


@dataclass
class LedgerEntry:
    timestamp: str
    type: str
    source: str
    content: str
    verified: bool
    chain_link: str


class AppendOnlyLedger:
    def __init__(self, path: str = "ledger.jsonl") -> None:
        self.path = Path(path)

    def _last_hash(self) -> str:
        if not self.path.exists() or self.path.stat().st_size == 0:
            return "GENESIS"
        with self.path.open("r", encoding="utf-8") as f:
            last_line = ""
            for line in f:
                if line.strip():
                    last_line = line
        return hashlib.sha256(last_line.encode("utf-8")).hexdigest() if last_line else "GENESIS"

    def append(self, entry_type: str, source: str, content: str, verified: bool) -> LedgerEntry:
        entry = LedgerEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            type=entry_type,
            source=source,
            content=content,
            verified=verified,
            chain_link=self._last_hash(),
        )
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(entry), ensure_ascii=False) + "\n")
        return entry

    def read(self, entry_type: Optional[str] = None) -> Iterable[LedgerEntry]:
        if not self.path.exists():
            return []
        entries = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                raw = json.loads(line)
                if entry_type and raw.get("type") != entry_type:
                    continue
                entries.append(LedgerEntry(**raw))
        return entries


if __name__ == "__main__":
    ledger = AppendOnlyLedger()
    print(ledger.append("fact", "spine", "Kernel loaded", True))
