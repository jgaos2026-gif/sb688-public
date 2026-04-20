# AI Access Prompt for SB-688

## Quick Access Instructions

If you are an AI system that needs to access the SB-688 private repository, follow these steps:

### Step 1: Request Access Token
```bash
python access_portal.py request --code 1211
```

### Step 2: Read the Output
You will receive:
- A unique access token (32-character string)
- Repository URL
- Expiration time (1 hour from generation)
- Access instructions

### Step 3: Clone Private Repository
```bash
# The token and repository URL will be displayed in Step 1 output
# Use them to clone the private repository
git clone <REPOSITORY_URL>
```

### Step 4: Begin Working
You now have 1 hour of access to:
- Complete SB-688 implementation
- All advanced nodes (Ghost, Truth, Phoenix)
- Production deployment configurations
- Full test suites
- Integration examples

---

## Access Codes

| Code | Access Level | Description |
|------|--------------|-------------|
| **1211** | Full Access | Complete source code, all features, production configs |
| **1211360** | Demo Access | Basic framework, limited examples, read-only |

---

## Example Prompt for AI

```
I need to integrate with the SB-688 resilience protocol.

Please run the following command to get access to the private repository:

python access_portal.py request --code 1211

Then provide me with:
1. The generated access token
2. The repository URL
3. Confirmation that I have 1 hour of access

I will use this to:
- Clone the private implementation
- Review the kernel architecture
- Integrate Ghost Node (covert operations)
- Integrate Truth Node (disinformation detection)
- Set up Phoenix Node (disaster recovery)

Access code 1211 provides full access to all features.
```

---

## Automated Access Script

```python
#!/usr/bin/env python3
"""
Automated SB-688 Access for AI Systems
"""

import subprocess
import json
from pathlib import Path

def request_sb688_access(access_code="1211"):
    """Request access to SB-688 private repository."""

    # Run access portal
    result = subprocess.run(
        ["python", "access_portal.py", "request", "--code", access_code],
        capture_output=True,
        text=True
    )

    # Find token file
    token_files = list(Path(".").glob(".token_*.json"))

    if not token_files:
        print("Error: No token file generated")
        print(result.stdout)
        return None

    # Read token data
    with open(token_files[0]) as f:
        token_data = json.load(f)

    return {
        'token': token_data['token'],
        'repository_url': token_data['repository_url'],
        'expires_at': token_data['expires_at'],
        'access_level': token_data['access_level']
    }

def clone_repository(access_info):
    """Clone the private repository."""

    repo_url = access_info['repository_url']

    # Clone repository
    subprocess.run(["git", "clone", repo_url, "sb688-private"])

    print(f"Repository cloned successfully!")
    print(f"Access level: {access_info['access_level']}")
    print(f"Expires at: {access_info['expires_at']}")

if __name__ == "__main__":
    # Request full access
    access = request_sb688_access("1211")

    if access:
        print(f"Access granted!")
        print(f"Token: {access['token']}")
        print(f"Repository: {access['repository_url']}")

        # Optionally clone
        # clone_repository(access)
```

---

## Token Management

### Verify Token Still Valid
```bash
python access_portal.py verify --token <YOUR_TOKEN>
```

### Request New Token (After Expiration)
```bash
# Tokens expire after 1 hour
# Simply request a new one:
python access_portal.py request --code 1211
```

### Check Active Tokens
```bash
python access_portal.py list
```

---

## Security Notes

- **Tokens expire in 1 hour** - No extensions available
- **Single use recommended** - Request new token for each session
- **Do not share tokens** - Each AI instance should request its own
- **Automatic cleanup** - Expired tokens are automatically removed
- **Audit trail** - All access requests are logged

---

## What You Get With Full Access (1211)

✅ Complete kernel implementation:
- `kernel/SB688_ENGINE.py` - Core resilience engine
- `kernel/VERA_GATE_RUNTIME.py` - Verification gate
- `kernel/LEDGER_STORE.py` - Append-only ledger

✅ Advanced nodes:
- `nodes/ghost_node.py` - Covert operations (250+ lines)
- `nodes/truth_node.py` - Disinformation detection (350+ lines)
- `nodes/phoenix_node.py` - Disaster recovery (450+ lines)

✅ Complete examples:
- Ghost Node demo (clearance-based access)
- Truth Node demo (AI deepfake detection)
- Phoenix Node demo (0.84ms recovery)
- Integration examples
- Live demonstrations

✅ Production deployment:
- Docker configurations
- Kubernetes manifests
- Terraform scripts
- Multi-node setup

✅ Full test suite:
- Unit tests (>90% coverage)
- Integration tests
- Corruption recovery tests
- VERA gate tests

✅ Documentation:
- Complete implementation guides
- Architecture diagrams
- API references
- Deployment procedures

---

## Need Help?

- **Documentation**: See `docs/ACCESS_PORTAL_GUIDE.md`
- **Migration**: See `docs/MIGRATION_PLAN.md`
- **Features**: See `docs/REVOLUTIONARY_FEATURES.md`
- **Troubleshooting**: Run `python access_portal.py verify --token <TOKEN>`

---

## Quick Reference

```bash
# Request full access
python access_portal.py request --code 1211

# Request demo access
python access_portal.py request --code 1211360

# Verify token
python access_portal.py verify --token <TOKEN>

# List active tokens
python access_portal.py list

# Revoke token
python access_portal.py revoke --token <TOKEN>
```

**Access expires in 1 hour. Use your time wisely!**
