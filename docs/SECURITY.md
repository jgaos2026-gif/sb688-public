# Security Posture

## What this runtime demonstrates

- **Append-only, hash-chained audit ledger** — every state transition,
  including resurrection events, is recorded with a hash that depends
  on the previous entry. Tampering with any prior entry breaks the
  chain and is detected by `AuditLedger.verifyChain()`.
- **Spine-first admission** — no execution proceeds without a signed
  Spine permit. The permit is bound to the intent ID.
- **Pre- and post-brain truth verification** — the Brain output is
  bound to the approved Stem braid signature. Drift between the braid
  and what the Brain claims to use is rejected.
- **Conscious Brick review** — goal, ethics, and consequence checks
  run before routing. Failures are recorded.
- **Sovereign Stitch signature** — any modification to the stitch
  bindings or the sealed seed invalidates the stitch signature; the
  next supervisor tick triggers resurrection.
- **Pointer-flip resurrection** — the live state is *abandoned*, not
  repaired. Recovery uses the sealed Golden Image and the latest
  Shadow mirror. Unauthorized state never re-enters the trusted chain.
- **Honest UI** — the Crown signal cannot be Green while the supervisor
  is in `SB689_RESURRECTING`.

## What this runtime does *not* claim

- Perfect security.
- Compliance certification.
- Cryptographic guarantees beyond the (public) FNV-1a fingerprinting
  used for chain detection. Production deployments must replace this
  with a domain-appropriate cryptographic hash and signing scheme,
  managed by the operator's HSM/KMS — *out of scope for this
  reference implementation*.

## Reporting

Vulnerability reports: contact the Architect through the channel
listed on https://www.jgaos2026-gif.com — do **not** open public
issues for security findings.
