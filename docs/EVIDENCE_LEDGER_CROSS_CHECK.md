# Evidence-Ledger Cross-Check (finding H, round 3)

## The problem

`BctVerifier` anchors each transition's parent against the
`BctHeadRegistry` — a registry the operator seeds. If the operator
seeds a wrong head, or a process restarts with a stale one, the
verifier anchors to it and cannot tell: head anchoring depends on
operator-controlled state. The cross-check adds a second, durable
record of heads that the verify path does not control: an **evidence
ledger**.

## The mechanism (what ships in this repo)

- `src/truth/EvidenceLedgerCrossCheck.ts` —
  `verifyHeadAgainstLedger(identity, localHead, reader)` checks one
  local head against the evidence ledger through the
  `EvidenceLedgerReader` interface (`latestHead()` + optional
  `headHistory()`). Outcomes: `MATCH` (verified), `NO_LEDGER_RECORD`,
  `MISMATCH`, `STALE_LOCAL_HEAD` (the local head is in the ledger's
  history but is no longer the latest — stale, not forged).
- `InMemoryEvidenceLedger` — a local stand-in implementing the same
  interface (tests, local development). Production uses a
  Supabase-backed reader; see below.
- `BctVerifier` accepts an optional reader as its 4th constructor
  argument. When set, the audit layer additionally requires the
  evidence ledger to agree with the local head:
  - **chained transition:** the ledger's head must EQUAL the prior
    head. A stale local head or a fork fails the audit layer.
  - **genesis transition:** the ledger must have NO record for the
    identity. An identity with a durable head can never start over.
  - Without a reader, behaviour is unchanged.

No code in this repo talks to a live Supabase project. The mechanism
is wired to a reader interface on purpose: the live wiring is an
operator step, below.

## What the operator enables, and how

### 1. Create the evidence table (Supabase, once)

A table that records one row per verified head, append-only:

```sql
create table evidence_ledger (
  id          bigint generated always as identity primary key,
  identity    text not null,
  head_hash   text not null,          -- 'sha256:' + 64 lowercase hex
  recorded_at timestamptz not null default now(),
  audit_hash  text,                   -- audit-ledger entry that recorded it
  constraint evidence_ledger_head_format
    check (head_hash ~ '^sha256:[0-9a-f]{64}$')
);
create index evidence_ledger_identity_idx on evidence_ledger (identity, id);
```

Row-level security: the verifier's key may only `SELECT`; only the
recording service/role may `INSERT`. Nobody updates or deletes rows.

### 2. Implement the reader (one small class)

```ts
import { createClient } from "@supabase/supabase-js";
import type { EvidenceLedgerReader, EvidenceLedgerEntry } from "./src/truth/EvidenceLedgerCrossCheck";

// Env (never commit these):
//   SB688_SUPABASE_URL                  — e.g. https://<ref>.supabase.co
//   SB688_SUPABASE_SERVICE_ROLE_KEY     — or an anon key with SELECT-only RLS
//   SB688_EVIDENCE_LEDGER_TABLE         — default "evidence_ledger"
class SupabaseEvidenceLedgerReader implements EvidenceLedgerReader {
  // latestHead(identity): SELECT head_hash, recorded_at, audit_hash
  //   FROM evidence_ledger WHERE identity = $1 ORDER BY id DESC LIMIT 1
  // headHistory(identity): same, ORDER BY id ASC
}
```

### 3. Wire it at the call site

```ts
import { BctVerifier } from "./src/truth/BctVerifier";

const verifier = new BctVerifier(
  auditLedger,
  systemClock,
  new BctHeadRegistry(),
  new SupabaseEvidenceLedgerReader()   // <- the evidence ledger
);
```

Good call sites: anywhere a `BctVerifier` is constructed for real
verification (a startup check, `IntegratedSystem`, or the service
that verifies run evidence). Do NOT wire it into the demo or the
test suite — those use `InMemoryEvidenceLedger`.

### 4. Record new heads (the write path)

The reader is read-only by design. After a verification returns
`trusted: true`, record the new head:

```ts
const result = verifier.verify(input);
if (result.trusted) {
  await supabase.from("evidence_ledger").insert({
    identity: input.identity,
    head_hash: input.declaredHash,
    audit_hash: result.auditHash
  });
}
```

Record ONLY after `trusted: true` — recording an untrusted head
would poison the durable record the next verification checks
against. If the insert fails, the local head advanced but the
durable record did not: the next verification of that identity will
fail the cross-check (stale/mismatch) until the operator records the
head — fail closed, by design. Do not "fix" that by seeding the
registry from the unverified local head.

### 5. Recovery when the cross-check fails

- `STALE_LOCAL_HEAD`: re-seed the registry from the evidence
  ledger's latest head (the durable record wins), then re-verify.
  Never verify against the old head.
- `MISMATCH`: the local head is unknown to the durable record —
  forked, forged, or seeded from an untrusted source. Stop and
  investigate; do not re-seed from the local value.
- `NO_LEDGER_RECORD` on a chained transition: the identity has no
  durable history. Either it is genuinely new (then genesis, not a
  chained transition) or its history was never recorded — record the
  known-good head through the write path above, with the operator
  attesting to its provenance.

## What this does NOT do

- It does not replace the registry: the registry is still the
  per-process anchor. The cross-check is a second opinion from
  durable storage.
- It does not authenticate the operator: the evidence ledger trusts
  whoever can write to it. Protect the write path (RLS, service
  role, audit the inserts) or the cross-check is only as honest as
  its writers.
- It does not make a single-process deployment durable on its own:
  the local head still needs to be re-seeded from the durable
  record after a restart (the registry is in-memory). The
  cross-check catches a WRONG re-seed; it cannot invent the right
  one.
