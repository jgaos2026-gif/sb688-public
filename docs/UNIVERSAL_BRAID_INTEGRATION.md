# Universal Braid integration record

**Repository role:** public integrity, evidence, and trust-state integration

This repository integrates with the authoritative [OASIS Universal Braid dual-machine contract](https://github.com/jgaos2026-gif/JGA-Universal-braid/blob/4a08c2b17877fad30ac3a96e12724b4f1ef7fafc/README.md) at commit `4a08c2b17877fad30ac3a96e12724b4f1ef7fafc`.

## Locked topology

- Pavilion node: `OASIS-PAVILION-01`
- ThinkBook node: `OASIS-THINKBOOK-01`
- each machine has its own OASIS Control Room, identity, keys, ledger, Watchdog, and recovery boundary
- the Universal Braid links the Control Rooms through Sovereign Stitch admission and mutually authenticated IronLink transport
- the machines exchange scoped, signed Braid envelopes; local data does not automatically replicate

## Locked protocol

- entry: **CONNECT TO THE STITCH**
- exit: **DISCONNECT FROM THE STITCH**
- admission: **VERIFY -> VALIDATE -> CERTIFY**
- **NO_BYPASS**
- **NO_SELF_CERTIFICATION**
- **FAILED_TESTS_REMAIN_VISIBLE**
- recovery adds evidence and never erases the original failure
- interfaces must display offline, degraded, quarantined, and uncertified states truthfully

## Implementation boundary

This record aligns the repository with the contract. It does **not** certify that the two physical machines are already connected. Live status requires signed evidence from both machines, bidirectional message tests, negative/replay tests, heartbeat-loss detection, clean disconnect checkpoints, Phoenix recovery tests, and independent Triad certification.

Implementations in this repository must reference a versioned Universal Braid contract and must not redefine the handshake or constitutional laws locally.
