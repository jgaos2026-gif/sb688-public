# Unified SB Mesh OS

**Beyond Verification:** A fully autonomous, scalable, and secure business operating system prototype. Built to merge the power of **SB688 Verification Law** and **SB712 Runtime**.

---

## Vision:
An enterprise OS for bold automation and ethical scalability:
- Verification-first workflows.
- Autonomous runtime cycles.
- Transparent proof through audit-ledgers.
- Modular Clip Brick deployments for distributed businesses.

---

## Features:
1. **SB688 Verification Law:** Ensuring ethical automation through strict data validity protocols.
2. **SB712 Runtime:** Automating all major business cycles (customer, sales, invoicing, compliance).
3. **Watchdog and Phoenix System:** Live system health checks and controlled checkpoint recovery.
4. **Quarantine System:** Isolate failed data or unauthorized processes from affecting operations.
5. **Clip Brick Modular Deployment:** Connect enterprise or satellite offices while enforcing access control.

---

## Repository Structure:
- `/src/sb688`: Verification modules and compliance law framework.
- `/src/sb712`: Autonomous runtime covering business cycles.
- `/docs`: Comprehensive documentation.
- `/examples`: Demo examples for critical workflows.
- `/tests`: Unit tests for key components.

---

## The Oasis — Modular Business Clip Bricks

**The Oasis** is the modular business deployment framework built on the Clip Brick architecture.
Each business unit connects as a numbered Clip Brick, operating independently while remaining
stitched into the shared runtime and governance layer.

| Brick | Business | Status |
|-------|----------|--------|
| **Brick 1** | **Jays Graphic Arts** | Active |

Additional bricks are onboarded through the standard Clip Brick provisioning process
and must pass SB688 verification before joining the stitch.

---

## Run Instructions:
1. Clone this repository.

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   npm install # For TypeScript components
   ```

3. Configure `.env`:
   ```bash
   cp .env.example .env
   ```

4. Run the system:
   ```bash
   python -m src.sb712.main demo-cycle
   ```

---
The system combines cutting-edge tools to demonstrate "**Verification Before Trust.**"
## System status and Triple Braid architecture

This repository documents the **triple braid** governance model and its **spine proxy** boundary. The current local SB688 Stitch manifest is an offline content-binding check; it is not a remote peer connection or certification. See [STITCH_BRIDGE.md](STITCH_BRIDGE.md) for the connection contract and lifecycle. The system status endpoint reports process health and ledger validity, not proof of a live Stitch connection.


## System status and integration boundary

**System status:** this repository contains the SB688 verification runtime and a local OMEGA brick manifest. A local hash check is not a remote peer connection or a cryptographic signature.

The **triple braid** is the independent verification path described by the public architecture. The **spine proxy** is the only permitted public intermediary toward spine governance. The detailed admission boundary is documented in [STITCH_BRIDGE.md](STITCH_BRIDGE.md).

The local Stitch currently reports OFFLINE / NOT_GRANTED until the transport, peer authentication, challenge-response, replay protection, heartbeat, and independent certification path are implemented and verified. No demo or health endpoint may describe this as a certified remote connection.
