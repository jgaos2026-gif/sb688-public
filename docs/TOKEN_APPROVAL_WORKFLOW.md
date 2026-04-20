# Token Approval Workflow

## Overview

All access tokens now require **manual administrator approval** before they can be used. This provides an additional security layer, ensuring you have full control over who accesses your private repository.

---

## How It Works

### 1. AI Requests Access
```bash
python access_portal.py request --code 1211
```

**Output:**
```
╔══════════════════════════════════════════════════════════════════╗
║            SB-688 ACCESS REQUEST RECEIVED                        ║
╚══════════════════════════════════════════════════════════════════╝

Access Level: FULL
Token: T7nF-ywxRdaE1Z0QyFa98RCpbhPi2z63eclmIv2YeLk
Status: PENDING APPROVAL
```

The token is created but **cannot be used yet**.

### 2. Administrator Reviews Pending Requests
```bash
python access_portal.py list-pending
```

**Output:**
```
Pending Access Requests:
================================================================================
Token: T7nF-ywxRdaE1Z0Q...
  Access Level: FULL
  Created: 2026-04-20T10:37:55
  Time Remaining: 59 minutes, 55 seconds
  Status: PENDING APPROVAL

  To approve: python access_portal.py approve --token T7nF-ywxRdaE1Z0Q...
  To deny:    python access_portal.py deny --token T7nF-ywxRdaE1Z0Q...
```

### 3. Administrator Approves or Denies

**Approve:**
```bash
python access_portal.py approve --token T7nF-ywxRdaE1Z0QyFa98RCpbhPi2z63eclmIv2YeLk
```

**Output:**
```
╔══════════════════════════════════════════════════════════════════╗
║                   TOKEN APPROVED                                 ║
╚══════════════════════════════════════════════════════════════════╝

Token: T7nF-ywxRdaE1Z0QyFa98RCpbhPi2z63eclmIv2YeLk
Access Level: FULL
Status: APPROVED

The token is now active and can be used to access the repository.
```

**Deny:**
```bash
python access_portal.py deny --token rYqAbU-e6ZbeeBooB7cPpcBsldM7tMuRKvHn2sJGHTE
```

**Output:**
```
╔══════════════════════════════════════════════════════════════════╗
║                   TOKEN DENIED                                   ║
╚══════════════════════════════════════════════════════════════════╝

Token: rYqAbU-e6ZbeeBooB7cPpcBsldM7tMuRKvHn2sJGHTE
Status: DENIED

The access request has been denied and the token is now invalid.
```

### 4. User Verifies Token Status
```bash
python access_portal.py verify --token T7nF-ywxRdaE1Z0QyFa98RCpbhPi2z63eclmIv2YeLk
```

**If pending:**
```
╔══════════════════════════════════════════════════════════════════╗
║                   TOKEN PENDING APPROVAL                         ║
╚══════════════════════════════════════════════════════════════════╝

Token: T7nF-ywxRdaE1Z0QyFa98RCpbhPi2z63eclmIv2YeLk
Status: AWAITING APPROVAL

This token has not yet been approved by the administrator.
```

**If approved:**
```
╔══════════════════════════════════════════════════════════════════╗
║                      TOKEN VALID                                 ║
╚══════════════════════════════════════════════════════════════════╝

Access Level: FULL
Time Remaining: 59 minutes, 42 seconds
Repository: https://github.com/YOUR-ORG/sb688-private
Status: APPROVED
```

---

## Administrator Commands

### List All Pending Requests
```bash
python access_portal.py list-pending
```
Shows all tokens awaiting approval with full details.

### List All Tokens (Including Status)
```bash
python access_portal.py list
```
Shows all tokens (approved and pending) with their status.

### Approve a Token
```bash
python access_portal.py approve --token <TOKEN>
```
Activates the token for use.

### Deny a Token
```bash
python access_portal.py deny --token <TOKEN>
```
Rejects the access request and invalidates the token.

### Revoke an Active Token
```bash
python access_portal.py revoke --token <TOKEN>
```
Immediately invalidates an approved token.

---

## Security Benefits

### 1. **Manual Control**
- Every access request requires your explicit approval
- No automatic access, even with valid codes

### 2. **Review Window**
- See who requested access before granting it
- Review access level (full vs demo)
- Check timing and context

### 3. **Instant Denial**
- Reject suspicious requests immediately
- Token never becomes active

### 4. **Audit Trail**
- All requests logged with timestamps
- Track approved vs denied requests
- Monitor access patterns

### 5. **Time-Limited**
- Even after approval, tokens expire in 1 hour
- Pending tokens also expire (can't be approved after expiration)
- Automatic cleanup of old requests

---

## Workflow Examples

### Example 1: Approve Legitimate Request
```bash
# AI requests access
$ python access_portal.py request --code 1211
Status: PENDING APPROVAL
Token: abc123...

# Admin reviews
$ python access_portal.py list-pending
Token: abc123...
  Access Level: FULL
  Status: PENDING APPROVAL

# Admin approves
$ python access_portal.py approve --token abc123...
STATUS: APPROVED

# AI can now use token
$ python access_portal.py verify --token abc123...
TOKEN VALID
Time Remaining: 59 minutes
```

### Example 2: Deny Suspicious Request
```bash
# Unknown AI requests access
$ python access_portal.py request --code 1211
Status: PENDING APPROVAL
Token: xyz789...

# Admin reviews
$ python access_portal.py list-pending
Token: xyz789...
  Access Level: FULL
  Status: PENDING APPROVAL

# Admin denies (suspicious timing/source)
$ python access_portal.py deny --token xyz789...
STATUS: DENIED

# AI cannot use token
$ python access_portal.py verify --token xyz789...
TOKEN INVALID OR EXPIRED
```

### Example 3: Bulk Review
```bash
# Multiple pending requests
$ python access_portal.py list-pending

Pending Access Requests:
Token 1: abc123... (FULL)
Token 2: def456... (DEMO)
Token 3: ghi789... (FULL)

# Approve legitimate ones
$ python access_portal.py approve --token abc123...
$ python access_portal.py approve --token def456...

# Deny suspicious one
$ python access_portal.py deny --token ghi789...
```

---

## Token States

| State | Description | Can Use? | Actions Available |
|-------|-------------|----------|-------------------|
| **PENDING** | Just created, awaiting approval | ❌ No | approve, deny |
| **APPROVED** | Manually approved by admin | ✅ Yes | revoke |
| **DENIED** | Rejected by admin | ❌ No | (none - invalid) |
| **EXPIRED** | Time limit exceeded | ❌ No | (none - auto-removed) |
| **REVOKED** | Manually revoked after approval | ❌ No | (none - invalid) |

---

## Important Notes

### Pending Tokens Still Expire
- Pending tokens count down the 1-hour timer
- If not approved within 1 hour, they expire
- Cannot approve expired tokens
- Request new token if expired

### Check Status Regularly
AI systems should poll the verify endpoint:
```bash
# Poll every minute until approved
while true; do
  python access_portal.py verify --token <TOKEN>
  if [ $? -eq 0 ]; then
    echo "Token approved!"
    break
  fi
  sleep 60
done
```

### No Automatic Approval
- **All codes (1211 and 1211360) require approval**
- No bypass mechanism
- Admin must approve every request

### Multiple Requests
- AI can request multiple times
- Each request creates new pending token
- Admin sees all pending requests
- Can approve one and deny others

---

## Configuration

The approval requirement is **always enabled** by default. There is no configuration to disable it - this is a security feature.

If you want to auto-approve for testing:
1. Request token: `python access_portal.py request --code 1211`
2. Immediately approve: `python access_portal.py approve --token <TOKEN>`

Or create a simple script:
```bash
#!/bin/bash
# auto-approve.sh
TOKEN=$(python access_portal.py request --code 1211 | grep "Token:" | awk '{print $2}')
python access_portal.py approve --token $TOKEN
```

---

## Summary

✅ **All tokens require manual approval**
✅ **Pending tokens visible with `list-pending`**
✅ **Approve with `approve --token <TOKEN>`**
✅ **Deny with `deny --token <TOKEN>`**
✅ **Tokens still expire in 1 hour (even if pending)**
✅ **Complete audit trail of all requests**
✅ **No automatic access - maximum security**

This system ensures you have **complete control** over who accesses your private repository, with a simple CLI workflow for reviewing and approving requests.
