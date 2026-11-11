# Stitch Bridge

## Public wall-brick role

This repository acts as the outermost **wall brick** in the SB689 v3
public framework. Its job is to describe how signals are received,
classified, verified, and forwarded without exposing private runtime
internals or giving direct access to the spine.

## Interaction model

1. **Outside Signal** reaches the public boundary.
2. **Silence Coat** dampens noise and nullifies unmanaged signals.
3. **Membrane Wall** encodes context into a form that the runtime can
   safely inspect.
4. **Cubic Inference Trap** contains inference and garbage logic until
   verification decides whether the material is useful, varied, or
   disposable.
5. **Verification Mesh** cross-checks the result before a qubic unit is
   allowed to act.
6. **Master Agent + Master Node Qubic** forms the paired decision point.
7. **Triple Braid** carries truth through three converging verification
   paths.
8. **Spine Proxy** relays only verified proxy commands.
9. **Read-Only Spine Governance** accepts no direct touch from outside
   the braid.
10. **Mirror / Ledger / Heartbeat** closes the loop with observation,
    logging, cooling, mirroring, and recovery readiness.

## Lifecycle of the braid system

- **Ingress:** outside signals meet the wall systems first.
- **Containment:** inference remains trapped until verified.
- **Braiding:** the qubic pair sends truth through triple-braid review.
- **Proxying:** only proxy-safe commands move toward the spine.
- **Governance:** the spine remains read-only to public-facing layers.
- **Recovery:** heartbeat, mirror, and ledger functions preserve state
  awareness and support self-healing cycles.

## Subsystem mapping

| Public layer | Runtime purpose |
|--------------|-----------------|
| Silence Coat | External signal nullification |
| Membrane Wall | Context encoding and controlled translation |
| Cubic Inference Trap | Trusted containment for unverified inference |
| Verification Mesh | Multi-path verification before action |
| Triple Braid | Truth convergence across independent paths |
| Spine Proxy | Verified intermediary between braid and spine |
| Mirror / Ledger / Heartbeat | Observation, traceability, and recovery |


## SB688 local Stitch status boundary

The SB688 OMEGA four-brick manifest is a local content-binding check. Its
SHA-256 value is **not** a cryptographic signature, peer identity, or
Universal Braid certification. A local manifest check cannot establish a
remote session.

Until the Universal Braid transport, peer identity exchange, signed
challenge-response, freshness/replay checks, heartbeat, disconnect seal,
Phoenix recovery, and independent Triad certification are implemented and
verified, `POST /api/omega/connect` reports `OFFLINE` /
`NOT_GRANTED` (HTTP 503). This is intentional fail-closed behavior, not a
failed local manifest check.

When the SB688 server is in production/staging or bound to a non-loopback
address, all API routes other than minimal health/readiness probes and the
separately authenticated `/api/truth/pre-brain` endpoint require
`Authorization: Bearer $SB688_OPERATOR_TOKEN`. The operator token must be
at least 32 characters and must be supplied through the deployment secret
manager, never committed to source.
