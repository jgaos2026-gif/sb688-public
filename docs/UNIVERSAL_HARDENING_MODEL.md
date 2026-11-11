# SB688 Universal Hardening Model

## Status

This document describes a defensive architecture and test harness. It is not a claim of universal security, production certification, medical certification, national-security accreditation, spacecraft qualification, or immunity to unknown attacks.

## Governing rule

**Purification is not trust. Alignment is not certification.**

Incoming data, model output, operator input, telemetry, files, recovery material, and cross-sovereign reports begin outside trusted state. A candidate may be normalized, inspected, provenance-checked, and cleared of known blocking conditions, but it remains a **PURIFIED_CANDIDATE** until the required assurance path is complete.

Canonical promotion path:

`INGEST -> ISOLATE -> CANONICALIZE -> INSPECT -> PROVENANCE CHECK -> VERIFY -> VALIDATE -> CERTIFY -> BRAID / REJOIN`

Canonical recovery path:

`QUARANTINE -> CHECKPOINT -> REPAIR -> RE-VERIFY -> RE-CERTIFY -> REJOIN`

Constitutional invariants remain:

- NO BYPASS
- NO SILENT TRUST
- NO SILENT REPAIR
- NO SELF-CERTIFICATION
- NO ERASED EVIDENCE
- no unverified or uncertified state may touch or modify a Spine

## Four specialized sovereign roles

The hardened fabric models four specialized sovereign roles rather than interchangeable copies:

1. **Sovereign 1 - StitchBrick Integrity**: purification, verification/validation support, quarantine, and governed recovery coordination. It does not inherit IronLink transport authority.
2. **Sovereign 2 - IronLink 3**: governed cross-sovereign transport only. It cannot certify, repair, or coordinate recovery.
3. **Sovereign 3 - Watchdog / Overseer**: correlate, alert, and escalate only. It cannot transport, repair, certify, or promote trust.
4. **Sovereign 4 - Qubix-inspired Node Brigade**: verification, validation support, reference comparison, re-verification, repair-candidate generation, and quarantine inside its bounded mesh. It reports upward to Sovereign 1 and cannot create a sideways federation bypass.

The roles cooperate through explicit reports, evidence references, policy versions, and IronLink transport gates. Shared constitutional law does not mean shared keys, shared memory, or shared authority.

## Hardened backend kernel

`HardenedBackendKernel` is transport-agnostic. HTTP, local IPC, industrial buses, spacecraft communications, deep-sea links, and future neural-interface adapters should terminate outside this kernel and submit governed request envelopes inward.

The kernel enforces:

- authentication before sensitive reads or state-changing operations
- bounded request size
- source identity and provenance for mutation
- current policy version alignment
- environment-specific purification rules
- fail-closed handling of unknown/high-risk signals
- no execution after a blocked access or purification decision
- human approval + checkpoint + evidence + independent certification before critical Stitch connection

The existing development server should not be treated as a hardened public perimeter merely because it defaults to loopback.

## Environment profiles

The current harness defines profiles for:

- general systems
- AI / autonomous agents
- critical infrastructure
- national-security environments
- medical neural-interface systems
- deep-space systems
- deep-sea systems
- financial systems
- healthcare systems
- industrial systems

These profiles tune limits such as authenticated-source requirements, provenance requirements, clock-skew tolerance, independent-certifier count, partition tolerance, and critical-change human approval. They are starting security profiles, not regulatory compliance certifications.

## Threat classes in the campaign

The test harness covers:

- malware or ransomware indicators
- data exfiltration indicators
- credential or session abuse
- replay / rollback abuse
- supply-chain tampering
- prompt or instruction injection
- data or memory poisoning
- rogue autonomous behavior
- policy or topology drift
- memory corruption
- checkpoint tampering
- ledger or evidence tampering
- transport partition or reordering
- clock / timebase faults
- resource exhaustion
- sensor or verifier disagreement
- external interference
- environmental faults
- unsafe action intent
- unknown threats

Threat signals are evidence inputs, not omniscient truth. Real deployments still require independent sensors, malware scanning, key management, hardware/firmware assurance, vulnerability management, secure transport, observability, and domain-specific safety controls.

## Reference fault campaign

A deterministic local campaign was run with seed `0x68871290` against the hardening modules before this branch was published.

Reference result:

- cases: **100,570**
- deployment profiles: **10**
- threat classes: **20**
- expected blocks: **99,280**
- actual blocks: **99,280**
- silent trust escapes: **0**
- execution escapes after blocked conditions: **0**
- false blocks in explicitly tolerated partition cases: **0**

See `evidence/universal_hardening_campaign_reference.json`.

Re-run after install/build with:

```bash
npm run hardening:campaign
```

The campaign is architecture/test-harness evidence. It is not a substitute for full repository CI, external penetration testing, fuzzing of parsers and protocols, cryptographic review, supply-chain review, hardware-in-the-loop testing, safety certification, or deployment-specific threat analysis.

## Deployment hardening still required

Before calling any deployment production-hardened, complete at minimum:

1. authenticated and encrypted transport appropriate to the environment
2. managed key lifecycle, rotation, revocation, compromise recovery, and hardware-backed custody where required
3. signed build and release provenance, SBOM, dependency policy, and vulnerability scanning
4. real malware/content scanning for files and executable material
5. rate limiting, replay protection, request identity, audit correlation, and abuse monitoring at the transport adapter
6. independent ledger anchoring or witnessing so a rewritten store cannot validate itself
7. independent certification roles that cannot be controlled by the repaired component
8. full recovery drills with corrupted checkpoints, lost links, stale time, partial power, split-brain state, and failed certifiers
9. environment-specific safety cases, including human override and fail-safe modes
10. external technical review and reproducible evidence before high-consequence deployment

## Claim discipline

The design goal is a universal integrity substrate. The engineering claim is narrower: **the architecture attempts to preserve trust boundaries, evidence, recovery discipline, and sovereign role separation across multiple deployment environments.** Each real industry deployment must still prove its own security, safety, reliability, performance, and compliance requirements.
