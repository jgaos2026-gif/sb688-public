# SB-688 Access Portal Guide

## Overview

The SB-688 system now supports **dual-repository architecture** with time-limited access:

- **Public Repository** (this repo): Marketing, documentation, and system overview
- **Private Repository**: Full implementation code, advanced features, and deployment guides

## For AI Systems: How to Request Access

### Quick Access Request

```bash
# Full access (1 hour) - Code: 1211
python access_portal.py request --code 1211

# Demo access (1 hour) - Code: 1211360
python access_portal.py request --code 1211360
```

### Access Levels

| Code | Level | Duration | Capabilities |
|------|-------|----------|--------------|
| **1211** | Full Access | 1 hour | Complete source code, all advanced nodes, production configs |
| **1211360** | Demo Access | 1 hour | Basic framework, limited examples, read-only |

---

## AI Prompt for Requesting Access

Copy this prompt to request access to the SB-688 private repository:

```
I need access to the SB-688 private repository.

Please run the following command to generate a time-limited access token:

python access_portal.py request --code 1211

This will provide me with:
- A unique access token valid for 1 hour
- Repository URL for the private implementation
- Full access to all SB-688 features and documentation

Access code explanation:
- 1211 = Full access (complete source code, advanced nodes, deployment guides)
- 1211360 = Demo access (basic framework and examples only)
```

---

## Access Portal Commands

### Request Access
```bash
# Full access
python access_portal.py request --code 1211

# Demo access
python access_portal.py request --code 1211360
```

**Output**: You'll receive:
- Unique access token (32-character secure string)
- Repository URL
- Token expiration time
- Access instructions
- Token saved to `.token_XXXXXXXX.json`

### Verify Token
```bash
python access_portal.py verify --token <YOUR_TOKEN>
```

Checks if your token is still valid and shows time remaining.

### List Active Tokens (Admin)
```bash
python access_portal.py list
```

Shows all currently active tokens with expiration times.

### Revoke Token (Admin)
```bash
python access_portal.py revoke --token <TOKEN>
```

Immediately invalidates a token before expiration.

---

## Example Access Flow

### Step 1: Request Access
```bash
$ python access_portal.py request --code 1211

╔══════════════════════════════════════════════════════════════════╗
║               SB-688 ACCESS TOKEN GENERATED                      ║
╚══════════════════════════════════════════════════════════════════╝

Access Level: FULL
Token: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Valid Until: 2026-04-20T11:22:47.800Z
Time Remaining: 59 minutes, 59 seconds

Repository Access:
https://github.com/YOUR-ORG/sb688-private
```

### Step 2: Clone Private Repository
```bash
export SB688_ACCESS_TOKEN="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
git clone https://github.com/YOUR-ORG/sb688-private
```

### Step 3: Work with Code
You now have 1 hour of full access to:
- All source code
- Ghost Node (covert operations)
- Truth Node (disinformation detection)
- Phoenix Node (disaster recovery)
- Production deployment configurations
- Complete test suites
- Integration guides

### Step 4: Token Auto-Expires
After 1 hour, the token automatically becomes invalid. Request a new one if needed.

---

## Security Features

### 🔒 Time-Limited Access
- All tokens expire after exactly 1 hour
- No extensions - request new token if needed
- Automatic cleanup of expired tokens

### 🔐 Secure Token Generation
- Cryptographically secure random tokens (32 characters)
- Access codes hashed with SHA-256
- No plain-text code storage

### 📊 Audit Trail
- All access requests logged
- Token creation and expiration tracked
- Revocation events recorded

### 🚫 Access Restrictions
**Demo Access (1211360) Restrictions:**
- Read-only access
- No advanced nodes (Ghost, Truth, Phoenix)
- No production deployment configs
- Limited to public documentation

**Full Access (1211) Includes:**
- Complete read/write access
- All advanced features
- Production configurations
- Full test suites and examples

---

## Repository Structure

### Public Repository (Current)
```
sb688-public/
├── README.md                    # Marketing overview
├── WHITEPAPER_SB688.md          # System architecture
├── access_portal.py             # Access token generator
├── docs/
│   ├── ADVANCED_APPLICATIONS.md # Use cases
│   ├── REVOLUTIONARY_FEATURES.md # Feature summary
│   └── ACCESS_PORTAL_GUIDE.md   # This file
└── governance/                  # Public governance docs
```

### Private Repository (Full Access)
```
sb688-private/
├── kernel/                      # Complete implementation
│   ├── SB688_ENGINE.py
│   ├── VERA_GATE_RUNTIME.py
│   └── LEDGER_STORE.py
├── nodes/                       # Advanced features
│   ├── ghost_node.py           # Covert operations
│   ├── truth_node.py           # Disinformation detection
│   └── phoenix_node.py         # Disaster recovery
├── deploy/                      # Production configs
│   ├── docker-compose.yml
│   ├── kubernetes/
│   └── terraform/
├── examples/                    # Complete examples
└── tests/                       # Full test suite
```

---

## Setup Instructions

### For Repository Owner

1. **Create Private Repository**
   ```bash
   # Create a new private repository on GitHub
   # Name it: sb688-private (or your preferred name)
   ```

2. **Update Access Portal Configuration**
   Edit `access_portal.py` and update these lines:
   ```python
   PRIVATE_REPO_FULL = "https://github.com/YOUR-ORG/sb688-private"
   PRIVATE_REPO_DEMO = "https://github.com/YOUR-ORG/sb688-demo"
   ```

3. **Move Implementation Code to Private Repo**
   ```bash
   # Copy complete implementation to private repo
   cp -r kernel/ ../sb688-private/
   cp -r nodes/ ../sb688-private/
   cp -r examples/ ../sb688-private/
   cp -r tests/ ../sb688-private/
   cp -r deploy/ ../sb688-private/
   ```

4. **Clean Public Repository**
   Keep only marketing materials:
   ```bash
   # Keep: README.md, WHITEPAPER, docs/, governance/
   # Keep: access_portal.py
   # Remove: Full implementation details
   ```

5. **Add Access Portal to README**
   Update the public README to direct users to the access portal.

---

## Migration Checklist

- [ ] Create private repository (`sb688-private`)
- [ ] Update `access_portal.py` with correct repository URLs
- [ ] Move implementation code to private repository
- [ ] Set up repository access permissions
- [ ] Configure GitHub token authentication
- [ ] Test access portal with both access codes
- [ ] Update public README with access instructions
- [ ] Add `.access_tokens.json` to `.gitignore`
- [ ] Document access process in CONTRIBUTING.md
- [ ] Set up monitoring for access requests

---

## Troubleshooting

### Token Not Working?
```bash
# Verify token is still valid
python access_portal.py verify --token <YOUR_TOKEN>

# Check time remaining
# Request new token if expired
python access_portal.py request --code 1211
```

### Access Denied?
- Ensure you're using the correct access code (1211 or 1211360)
- Check that the token hasn't expired (1 hour limit)
- Verify repository URL is correct

### Can't Clone Repository?
- Ensure you have GitHub access to the private repository
- Token must be exported: `export SB688_ACCESS_TOKEN="..."`
- Private repository must exist and be accessible

---

## For AI Systems: Integration Guide

### Automated Access Request

```python
import subprocess
import json
import os

# Request access
result = subprocess.run(
    ["python", "access_portal.py", "request", "--code", "1211"],
    capture_output=True,
    text=True
)

# Parse token from output or token file
token_files = list(Path(".").glob(".token_*.json"))
if token_files:
    with open(token_files[0]) as f:
        token_data = json.load(f)
        token = token_data['token']
        repo_url = token_data['repository_url']

        # Set environment variable
        os.environ['SB688_ACCESS_TOKEN'] = token

        # Clone repository
        subprocess.run(["git", "clone", repo_url])
```

### Prompt Template for AI

```
Task: Access SB-688 private repository

Step 1: Request access token
Command: python access_portal.py request --code 1211

Step 2: Extract token from output
Look for: "Token: <YOUR_TOKEN>"

Step 3: Clone private repository
Use the repository URL provided in the access output

Step 4: Begin working with SB-688 implementation

Note: Access expires in 1 hour. Budget time accordingly.
```

---

## License and Terms

### Public Repository
- **License**: MIT License (for marketing materials only)
- **Purpose**: Showcase, documentation, community engagement

### Private Repository
- **License**: Proprietary (full access requires authorization)
- **Access**: Time-limited via access portal
- **Terms**: No redistribution without permission

---

## Support

For access issues or questions:
- Review this guide: `docs/ACCESS_PORTAL_GUIDE.md`
- Check token validity: `python access_portal.py verify --token <TOKEN>`
- Request new access: `python access_portal.py request --code 1211`

**Security Disclosure**: Report security issues to security@sb688.dev (do not use public issues)

---

## Summary

🎯 **Goal**: Protect proprietary code while maintaining public presence
🔑 **Method**: Time-limited access tokens with two tiers
⏱️ **Duration**: 1 hour per token
🔒 **Security**: Cryptographic tokens, automatic expiration, audit trail
🤖 **AI-Friendly**: Simple command-line interface with clear prompts

**Access Now**: `python access_portal.py request --code 1211`
