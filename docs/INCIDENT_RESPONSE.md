# Security Incident Response

## Vulnerability intake

1. Do not open public issues for security findings.
2. Report through the private channel documented in `docs/SECURITY.md`.
3. Include reproduction details, affected versions, and impact.

## Severity policy

- **Critical:** actively exploitable or credential/signature compromise
- **High:** major integrity or availability impact
- **Medium:** bounded impact with mitigations
- **Low:** minimal practical impact

## Response process

1. Triage and severity assignment
2. Containment and temporary mitigation
3. Root-cause fix and test coverage updates
4. Release with changelog notes
5. Post-incident review and follow-up actions

## Dependency vulnerability fix policy

- PR and main dependency scans are mandatory.
- Critical/High findings block release.
- Medium findings require explicit risk acceptance before release.
- Low findings are tracked and scheduled in normal maintenance cycles.
