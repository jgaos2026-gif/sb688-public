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
- Cryptographic guarantees beyond public SHA-256 hash-chaining and
  signature checks in this reference implementation. Production
  deployments should still use operator-managed key custody and
  signing policies (HSM/KMS-backed operations).

## Round 3 hardening (2026-11-10)

- **Braid binding, not a braid "signature".** The BCT braid value is
  an unkeyed SHA-256 hash (`braidBindingHash`) — it proves the values
  match and authenticates nobody. It is named as a binding
  everywhere in `BctVerifier` so no reader mistakes it for
  authentication. Real issuer authentication lives in the Ed25519
  permit signatures (`SpinePermitCrypto`). The Stem braid value
  (`StemPacket.braidSignature`) and the Phoenix patrol hash map are
  separate components and still carry the old name — see the round-3
  report.
- **Ledger: disk before memory, single writer.** Appends write +
  fsync before publishing to memory; a failed write leaves memory
  untouched. File-backed ledgers serialize verify+append through an
  OS-level lockfile, sync with the file under the lock on every
  append, and recover a torn final line by truncation on load.
- **Trust is conditional on the durable audit commit.** The BCT head
  advances only after the ledger append succeeds; a failed commit
  means `trusted: false` and the head does not move.
- **Rollback modes are explicit.** `NO_MUTABLE_PARTICIPANTS` /
  `RESTORE_VERIFIED` / `RESTORE_FAILED` — a run with no mutable
  participants never claims a verified restore.
- **Durable permit replay.** Used permit signatures can be persisted
  (`replayStorePath`) and are re-checked from disk, so a replay
  after restart is rejected.
- **Keys fail visibly.** `SpineGovernor({ requireDurableKey: true })`
  throws at startup when no durable key is configured; the default
  ephemeral key is labeled `keyProvenance: "ephemeral"`.
- **Evidence-ledger cross-check.** `BctVerifier` optionally verifies
  the local head against a durable evidence ledger (Supabase table)
  — see `docs/EVIDENCE_LEDGER_CROSS_CHECK.md`. Not wired to any live
  project in this repo.
- **Shared canonical numbers.** `stableStringify`/`hashOf` use the
  cross-language canonical numeric form (see `src/utils/hash.ts`),
  and reject non-finite numbers instead of hashing them as `null`.

## Reporting

Vulnerability reports: contact the Architect through the channel
listed on https://www.jgaos2026-gif.com — do **not** open public
issues for security findings. See `docs/INCIDENT_RESPONSE.md` for
severity handling and release-blocking policy.
