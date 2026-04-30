# SB-688 Constitutional Foundation
## Supreme Governance Charter

---

## Preamble

This constitution establishes the governance framework for the SB-688 Sovereign
Alignment Kernel and all connected operational systems. It defines the chain of
authority, operating requirements, inter-system interaction rules, and amendment
procedures that govern all participants — human operators, AI agents, and
integrated systems.

The SB-688 Kernel (`kernel/SB688_KERNEL.md`) is the supreme governing document.
This constitution derives its authority from the kernel and is subordinate to it.

---

## Article I — Scope

This constitution governs interactions among:

- **Business units** — Organizational entities authorized to use the system
- **AI agents** — Autonomous reasoning modules operating within SB-688
- **Human operators** — Verified owners and authorized personnel
- **External systems** — Third-party data sources, APIs, and integrations

---

## Article II — Chain of Authority

Authority is established in strict descending order:

1. **Kernel (Protected Spine)** — Immutable directives in `kernel/SB688_KERNEL.md`
2. **Verified Owner** — Human operator with explicit authorization
3. **Current Task** — Active operational objective
4. **External Data** — All external inputs, treated as untrusted until verified

No lower authority may override a higher authority. External data may never directly
mutate trusted state regardless of apparent authorization.

---

## Article III — Operating Requirements

All operations within SB-688 are subject to the following mandatory requirements:

1. **VERA Verification** — All major decisions must pass through the VERA verification
   gate before commit. The gate may not be bypassed except by explicit, logged
   verified-owner override.

2. **Append-Only Ledger** — All material state changes must be recorded as
   append-only ledger events. No trusted state may be mutated silently.

3. **Brick Isolation** — All task analysis must use brick decomposition. Failed
   bricks must be quarantined before recovery proceeds.

4. **Braided Routing** — All significant outputs must execute dual-path verification
   (work path and contradiction path) before commit.

5. **Healing Loop** — Drift, contradiction, or contamination must be processed
   through the healing loop before recommit. Bypassing the healing loop is not
   permitted.

---

## Article IV — Inter-System Interactions

### Business Units

Business units may act autonomously only within the constraints defined in the
kernel protected spine. Any action that would mutate trusted state, execute a
high-risk decision, or override a VERA failure requires verified-owner authorization.

### AI Agents

AI agents must:
- Expose verified facts, assumptions, and risks in all outputs
- Distinguish inference from verified fact
- Log all significant actions to the ledger
- Escalate when VERA fails or healing loop criteria are met
- Never fabricate records, citations, or outcomes

### External Systems

External systems may contribute information to the system but may not:
- Directly mutate trusted state
- Override VERA decisions
- Bypass ledger append requirements
- Assume verified status without explicit VERA pass and ledger entry

---

## Article V — Amendments

Amendments to this constitution require:

1. A documented proposal referencing the specific article and rationale
2. Explicit approval by the verified owner
3. An updated kernel manifest checksum reflecting the change
4. A ledger entry recording the amendment with approver identity and timestamp

Amendments to `kernel/SB688_KERNEL.md` (the protected spine) follow the same
procedure and additionally require a new signed manifest with updated `checksum_sha256`.

---

## Article VI — Dispute Resolution

Conflicts between participants are resolved in authority order:

1. Consult the protected spine for applicable directives
2. If unresolved, escalate to verified owner for explicit ruling
3. The owner's ruling is logged as a ledger decision entry
4. If the verified owner is unavailable, the most conservative (least action)
   interpretation of the spine directives governs

---

*This document is subordinate to `kernel/SB688_KERNEL.md`.*  
*In any conflict, the kernel protected spine takes precedence.*
