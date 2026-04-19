# SB-688 Kernel Implementation Guide

## 1) Drop-in System Prompt
Use `examples/sb688_system_prompt.txt` directly for OpenAI, Claude, or custom orchestration.

## 2) Segment Context into Bricks
For each request, build this structure:
- Objective
- Facts (verified/unverified)
- Assumptions
- Constraints
- Risks
- Actions

Keep each brick isolated and versioned so failed analysis can be quarantined without full-context collapse.

## 3) Run Dual-Path (Braided) Verification
- Path A: generate answer/action.
- Path B: contradiction + evidence scan.
- If conflict exists, reject commit and invoke healing loop.

## 4) Invoke VERA Gate
VERA gate input should include:
- candidate output,
- cited facts and sources,
- uncertainty statements,
- risk category.

VERA output should include:
- pass/fail,
- reasons,
- required escalations.

## 5) Maintain Append-Only Ledger
Append entries for facts, assumptions, rejections, decisions, and rollbacks. Never rewrite prior entries; issue new correction entries instead.

## 6) Recovery Procedure (Drift Detected)
Detect -> isolate -> rollback -> restitch from `kernel/SB688_KERNEL.md` -> re-run VERA -> commit.

## 7) Integration Examples
- API wrapper: `examples/vera_gate.py`
- Chat flow: `examples/dual_path_verification.py`
- Batch/audit flow: `examples/ledger_client.py`, `examples/healing_loop.py`
- HTTP invocation pattern: `examples/curl_request.sh`
