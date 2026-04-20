# SB-688 Repository Migration Plan

## Overview
This document outlines the strategy for splitting the SB-688 codebase into:
1. **Public Repository** - Marketing, showcase, and access portal
2. **Private Repository** - Complete implementation and proprietary code

---

## Phase 1: Create Private Repository

### Step 1.1: GitHub Repository Setup
```bash
# On GitHub:
# 1. Go to https://github.com/new
# 2. Repository name: sb688-private
# 3. Visibility: Private
# 4. Initialize with README: No (we'll push from existing code)
# 5. Create repository
```

### Step 1.2: Clone and Initialize Private Repo
```bash
# Clone the new empty private repo
git clone https://github.com/YOUR-USERNAME/sb688-private.git
cd sb688-private

# Initialize with basic structure
git checkout -b main
```

---

## Phase 2: Migrate Implementation Code

### Step 2.1: Copy Core Implementation
From `sb688-public` to `sb688-private`:

```bash
# Full implementation files
cp -r kernel/ ../sb688-private/
cp -r nodes/ ../sb688-private/
cp -r examples/ ../sb688-private/
cp -r tests/ ../sb688-private/
cp -r deploy/ ../sb688-private/

# Supporting files
cp sb688.py ../sb688-private/
cp Makefile ../sb688-private/
cp .gitignore ../sb688-private/

# Documentation (keep proprietary docs private)
cp CONTRIBUTING.md ../sb688-private/
cp WHITEPAPER_SB688.md ../sb688-private/
```

### Step 2.2: Files to Keep in Private Repo
- ✅ All `.py` files in `kernel/`
- ✅ All `.py` files in `nodes/` (Ghost, Truth, Phoenix)
- ✅ All `.py` files in `examples/`
- ✅ All test files in `tests/`
- ✅ All deployment configs in `deploy/`
- ✅ Complete documentation
- ✅ CLI interface (`sb688.py`)

### Step 2.3: Commit to Private Repository
```bash
cd sb688-private

git add .
git commit -m "Initial private repository with complete SB-688 implementation

- Complete kernel implementation (SB688_ENGINE, VERA_GATE, LEDGER_STORE)
- Advanced nodes (Ghost, Truth, Phoenix)
- Full test suite with >90% coverage
- Production deployment configurations
- Complete examples and integration guides
- All proprietary features and algorithms"

git push origin main
```

---

## Phase 3: Clean Public Repository

### Step 3.1: Create Public-Only Branch
```bash
cd sb688-public

# Create new branch for public version
git checkout -b public-marketing
```

### Step 3.2: Remove Implementation Code
Keep only marketing materials:

```bash
# Remove full implementations (keep stubs/interfaces only)
rm -rf kernel/*.py
rm -rf nodes/*.py
rm -rf examples/*.py
rm -rf tests/
rm -rf deploy/

# Keep these files:
# - README.md (update with marketing focus)
# - WHITEPAPER_SB688.md (high-level only)
# - docs/ (marketing docs only)
# - governance/ (public governance)
# - access_portal.py (NEW)
# - LICENSE
```

### Step 3.3: Create Marketing Stubs
Create simplified versions:

**kernel/README.md**:
```markdown
# SB-688 Kernel

The SB-688 kernel provides:
- Protected spine with immutable mission directives
- VERA gate for verification
- Append-only ledger for auditability

For full implementation, request access via the Access Portal.
```

**nodes/README.md**:
```markdown
# SB-688 Advanced Nodes

- **Ghost Node**: Covert operations with compartmentalized security
- **Truth Node**: AI disinformation detection
- **Phoenix Node**: Sub-millisecond disaster recovery

For complete source code, use access code 1211 with the Access Portal.
```

### Step 3.4: Update Public README
Replace implementation details with marketing:

```markdown
# SB-688 Sovereign Alignment Kernel

Revolutionary resilience protocol for mission-critical AI systems.

## Why SB-688?

- 🚀 **$58B Annual Savings**: Government efficiency gains
- ⚡ **0.84ms Recovery**: 2380x faster than traditional systems
- 🔒 **Zero Cross-Contamination**: Compartmentalized security
- 🛡️ **Adversarial Resilience**: AI disinformation detection
- 🌌 **Deep Space Ready**: Radiation-hardened autonomous recovery

## Access the System

### For AI Systems
Request time-limited access to the complete implementation:

```bash
# Full access (1 hour)
python access_portal.py request --code 1211

# Demo access (1 hour)
python access_portal.py request --code 1211360
```

## Features

- **Ghost Node**: Covert operations with self-destruct
- **Truth Node**: Dual-path disinformation detection
- **Phoenix Node**: Sub-millisecond disaster recovery

## Documentation

- [Advanced Applications](docs/ADVANCED_APPLICATIONS.md)
- [Revolutionary Features](docs/REVOLUTIONARY_FEATURES.md)
- [Access Portal Guide](docs/ACCESS_PORTAL_GUIDE.md)
- [Whitepaper](WHITEPAPER_SB688.md)

## Get Access

For complete source code and implementation guides:
1. Review the [Access Portal Guide](docs/ACCESS_PORTAL_GUIDE.md)
2. Request access: `python access_portal.py request --code 1211`
3. Clone private repository with provided token
4. Begin integration

## Use Cases

- Deep space missions (Mars rovers, satellite networks)
- National security (classified operations)
- Critical infrastructure (power grids, financial systems)
- Healthcare (surgical robots, patient data)
- Government operations ($58B+ annual savings)

## License

Marketing materials: MIT License
Implementation: Proprietary (access via Access Portal)
```

---

## Phase 4: Configure Access Portal

### Step 4.1: Update Repository URLs in access_portal.py
```python
# In access_portal.py, update these lines:
PRIVATE_REPO_FULL = "https://github.com/YOUR-USERNAME/sb688-private"
PRIVATE_REPO_DEMO = "https://github.com/YOUR-USERNAME/sb688-demo"  # Optional
```

### Step 4.2: Test Access Portal
```bash
# Test full access
python access_portal.py request --code 1211

# Test demo access
python access_portal.py request --code 1211360

# Verify token
python access_portal.py verify --token <GENERATED_TOKEN>

# List active tokens
python access_portal.py list
```

### Step 4.3: Add to .gitignore
```bash
echo ".access_tokens.json" >> .gitignore
echo ".token_*.json" >> .gitignore
```

---

## Phase 5: GitHub Access Configuration

### Step 5.1: Set Up GitHub Personal Access Token
For AI systems to clone the private repo:

```bash
# On GitHub:
# 1. Settings → Developer settings → Personal access tokens → Fine-grained tokens
# 2. Generate new token
# 3. Repository access: Only select repositories → sb688-private
# 4. Permissions: Repository → Contents → Read
# 5. Generate and save token
```

### Step 5.2: Configure Repository Access
```bash
# For automated access, update repository URLs to include token placeholder:
https://${SB688_ACCESS_TOKEN}@github.com/YOUR-USERNAME/sb688-private.git
```

### Step 5.3: Add Collaborators (Optional)
```bash
# On GitHub:
# sb688-private → Settings → Collaborators
# Add specific users/teams with appropriate permissions
```

---

## Phase 6: Create Demo Repository (Optional)

### Step 6.1: Create sb688-demo Repository
```bash
# On GitHub: Create sb688-demo (private)
git clone https://github.com/YOUR-USERNAME/sb688-demo.git

# Copy limited examples
cp -r examples/demo_*.py ../sb688-demo/
cp README.md ../sb688-demo/
cp LICENSE ../sb688-demo/
```

### Step 6.2: Configure Demo Access
Demo access (1211360) provides:
- Basic framework overview
- Limited examples (no advanced nodes)
- Read-only documentation
- No production configs

---

## Phase 7: Update Documentation

### Step 7.1: Update CONTRIBUTING.md
```markdown
# Contributing to SB-688

## Access Requirements

To contribute to SB-688:
1. Request access: `python access_portal.py request --code 1211`
2. Clone private repository with provided token
3. Create feature branch
4. Submit pull request to private repository

## Public vs Private

- **Public repo**: Marketing, documentation, access portal
- **Private repo**: Implementation, advanced features, tests
```

### Step 7.2: Create Security Policy
**SECURITY.md**:
```markdown
# Security Policy

## Reporting Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

Email: security@sb688.dev

## Access Control

- Time-limited tokens (1 hour)
- Two-tier access (full/demo)
- Automatic expiration
- Audit logging

## Responsible Disclosure

We follow a 90-day disclosure timeline.
```

---

## Phase 8: Testing & Validation

### Step 8.1: Test Access Flow
```bash
# 1. Request access
python access_portal.py request --code 1211

# 2. Extract token
TOKEN=$(cat .token_*.json | jq -r '.token')

# 3. Test clone
export SB688_ACCESS_TOKEN=$TOKEN
git clone https://github.com/YOUR-USERNAME/sb688-private.git test-clone

# 4. Verify contents
ls test-clone/
# Should see: kernel/, nodes/, examples/, tests/, deploy/

# 5. Clean up
rm -rf test-clone
```

### Step 8.2: Validate Token Expiration
```bash
# Generate token
python access_portal.py request --code 1211

# Wait 1 hour + 1 minute

# Verify expired
python access_portal.py verify --token <TOKEN>
# Should show: TOKEN INVALID OR EXPIRED
```

### Step 8.3: Test Both Access Levels
```bash
# Full access
python access_portal.py request --code 1211
# Verify: Access Level: FULL

# Demo access
python access_portal.py request --code 1211360
# Verify: Access Level: DEMO
```

---

## Phase 9: Marketing & Communication

### Step 9.1: Update Public README
Focus on:
- Revolutionary features
- Use cases and benefits
- Clear access instructions
- Call to action

### Step 9.2: Create Marketing Materials
- **Feature comparison** (public vs full access)
- **Use case examples**
- **Performance metrics** ($58B savings, 0.84ms recovery)
- **Demo videos/screenshots**

### Step 9.3: AI Integration Instructions
Create clear prompts for AI systems:

```
To access SB-688 private implementation:

1. Run: python access_portal.py request --code 1211
2. Copy the generated token
3. Clone: git clone https://github.com/YOUR-USERNAME/sb688-private.git
4. Export: export SB688_ACCESS_TOKEN="<your-token>"
5. Begin integration

Access expires in 1 hour. Request new token if needed.
```

---

## Phase 10: Monitoring & Maintenance

### Step 10.1: Set Up Access Logging
```python
# Add logging to access_portal.py
import logging

logging.basicConfig(
    filename='access_portal.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Log all access requests
logging.info(f"Access request: code={access_code}, token={token}, level={access_level}")
```

### Step 10.2: Regular Cleanup
```bash
# Add to cron or scheduled task
# Clean expired tokens daily
python access_portal.py cleanup
```

### Step 10.3: Monitor Usage
Track:
- Number of access requests
- Full vs demo access ratio
- Token usage patterns
- Access violations

---

## Rollback Plan

If migration issues occur:

```bash
# Public repo
cd sb688-public
git checkout main  # Return to pre-migration state

# Private repo
cd sb688-private
# Private repo can be deleted if needed (before use)
```

---

## Checklist

### Pre-Migration
- [ ] Backup current repository
- [ ] Review all code for sensitive information
- [ ] Decide what stays public vs private
- [ ] Create GitHub personal access tokens

### Migration
- [ ] Create private repository
- [ ] Copy implementation to private repo
- [ ] Clean public repository
- [ ] Update access_portal.py with correct URLs
- [ ] Test access portal functionality
- [ ] Update all documentation

### Post-Migration
- [ ] Test full access flow (code 1211)
- [ ] Test demo access flow (code 1211360)
- [ ] Verify token expiration (1 hour)
- [ ] Update public README
- [ ] Set up access logging
- [ ] Monitor first week of usage

### Optional
- [ ] Create sb688-demo repository
- [ ] Add CI/CD for private repo
- [ ] Set up automated testing
- [ ] Configure access analytics

---

## Timeline

- **Week 1**: Create private repo, migrate code
- **Week 2**: Clean public repo, configure access portal
- **Week 3**: Testing and documentation
- **Week 4**: Launch and monitor

---

## Support

For migration questions:
- Review this migration plan
- Test in staging environment first
- Document any issues encountered
- Update this plan with lessons learned
