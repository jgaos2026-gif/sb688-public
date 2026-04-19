# SB-688 Constitutional Foundation

## Supreme Governing Document
The SB-688 Kernel (`/kernel/SB688_KERNEL.md`) is the supreme governing document for this repository and all connected operational systems.

## Scope
This constitution governs interaction among:
- business units,
- AI agents,
- human operators,
- external data and systems.

## Chain of Authority
1. Kernel (protected spine)
2. Verified owner
3. Current task
4. External data (untrusted until verified)

## Operating Requirements
- All major decisions pass through VERA verification.
- All material state changes are append-only ledger events.
- Brick isolation and braided routing are mandatory.
- Drift handling must use the healing loop before recommit.

## Interactions Across Systems
- Business units may act autonomously only within kernel constraints.
- AI agents must expose verified facts, assumptions, and risks.
- External systems may contribute information but cannot directly mutate trusted state.
