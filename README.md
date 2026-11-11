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

## Sovereign hardening fabric (integrated candidate)

This branch integrates the previously separate Sovereign hardening work with the current SB688 mainline. The additions are executable policy and test modules, not a claim that a production deployment is already autonomous.

- **Trust state machine:** legal state transitions are explicit; recovery cannot jump directly to certification.
- **Recovery capsules:** Stitch control state and memory remain separate. Memory cannot overwrite Stitch-owned keys. A recovered state remains untrusted until a healthy, verified, validated scan.
- **Evidence bundles and ledger anchors:** verification runs can produce machine-readable and human-readable evidence; ledger anchors bind record count, head hash, and a SHA-256 digest.
- **Proactive integrity fabric:** threat detection freezes trust promotion; incident learning requires evidence-backed verification, validation, certification, and governed promotion.
- **Four-sovereign fabric:** Stitch integrity/recovery coordination, transport, watchdog correlation/escalation, and node-brigade verification have distinct role boundaries.
- **Universal hardening and operator access gates:** environment profiles, source/provenance requirements, action sensitivity, and fail-closed policy decisions.
- **Hardened backend kernel:** a transport-agnostic boundary that keeps adapters outside the trust core.
- **Heartbeat governor:** deterministic heartbeat, missed-beat, quarantine, and recovery policy logic.
- **Campaigns:** `npm run evidence`, `npm run hardening:campaign`, and `npm run hardening:super`.

### Operational boundary

These modules do not create a self-starting production daemon by themselves. A deployment still needs a supervisor/scheduler to invoke heartbeat and patrol cycles, persistent storage for state and evidence, real independent verifier services, key custody, monitoring/alert delivery, and a configured action policy. The campaign results are test-harness evidence, not external penetration testing or production certification.


## Public architecture alignment

**System status** is determined by executable health checks and preserved evidence, not by labels in documentation. The **triple braid** describes independent verification paths and must be measured in each deployment. The **spine proxy** is the only permitted boundary for governed state changes. See [`STITCH_BRIDGE.md`](STITCH_BRIDGE.md) for the `stitch_bridge.md` lifecycle and integration contract.


**Heartbeat persistence limitation:** `SovereignHeartbeatGovernor` currently keeps per-node sequence, probation, freeze, and quarantine state in process memory. A process restart resets that state. Production autonomous recovery must first add durable, integrity-checked state replay (for example, from the file-backed AuditLedger) and verify it across restarts; the heartbeat class alone is not a production watchdog.
