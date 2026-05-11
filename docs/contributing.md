# Contributing — SB689 OMEGA · Sovereign Stitch (Python PC Runtime)

Thank you for your interest in contributing to the Sovereign Stitch PC runtime.

## Ground rules

1. **Read the constitution first.**  `config/constitution.yaml` defines the immutable
   governing principles.  All changes must comply with ART-001 through ART-006.

2. **Zero-tolerance for broken tests.**  `pytest` must pass with zero failures
   before any pull request is merged.

3. **Follow the brick contract.**  Each brick's interface is part of the public API.
   Do not change method signatures without a matching update to the TypeScript layer
   (`src/omega/`) and the test suite.

4. **Audit-log every state transition.**  Any new supervisor path must append an
   entry to `_audit_log` with a label, timestamp, and detail dict.

## Development setup

```bash
bash scripts/init.sh
source .venv/bin/activate
pytest
```

## Adding a new fault scenario

1. Add a fault-injection method or flag to `sovereign_stitch_pc.py`.
2. Add a corresponding test class in `tests/test_sovereign_stitch.py`.
3. Update `docs/changelog.md` under the next version heading.

## Submitting a pull request

- Branch from `main`.
- Keep commits small and focused.
- Include a description of which article(s) of the constitution the change complies with.
- The PR title should begin with one of: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

## Code style

- Python 3.9+ compatible.
- Type annotations on all public methods.
- No third-party dependencies beyond what is in `requirements.txt`.
- Docstrings in Google style (single-line or multi-line as appropriate).

## Governance change class

| Change class | Approval required |
|---|---|
| Bug fix (no API change) | 1 maintainer review |
| New public API | 2 maintainer reviews |
| Constitution amendment | Governing body vote |

See [docs/GOVERNANCE.md](GOVERNANCE.md) for the full change-class taxonomy.
