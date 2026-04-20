# Contributing to SB-688

Thank you for your interest in contributing to the SB-688 Sovereign Alignment Kernel project!

## Code of Conduct

All contributors must adhere to the [Code of Conduct](governance/CODE_OF_CONDUCT.md) and the [Constitution](governance/CONSTITUTION.md).

## How to Contribute

### Reporting Issues

- Use the GitHub issue tracker
- Provide clear, detailed descriptions
- Include reproduction steps for bugs
- Tag issues appropriately (bug, enhancement, documentation, etc.)

### Development Workflow

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/sb688-public.git
   cd sb688-public
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Install Dependencies**
   ```bash
   python -m pip install -r tests/requirements.txt
   ```

4. **Make Changes**
   - Follow the brick isolation pattern
   - Maintain the chain of authority
   - Add tests for new functionality
   - Update documentation as needed

5. **Run Tests**
   ```bash
   make test
   ```

6. **Verify Your Changes**
   ```bash
   python sb688.py verify
   ```

7. **Commit**
   ```bash
   git add .
   git commit -m "Brief description of changes"
   ```

8. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Coding Standards

- **Python**: Follow PEP 8 style guidelines
- **Documentation**: Use clear docstrings for all public functions
- **Type Hints**: Add type hints where appropriate
- **Comments**: Explain why, not what

### Testing Requirements

All contributions must include appropriate tests:
- Unit tests for individual components
- Integration tests for cross-component functionality
- Ensure all existing tests pass
- Aim for meaningful test coverage

### Documentation

Update documentation for:
- New features or functionality
- API changes
- Configuration options
- Usage examples

Required documentation files:
- `README.md` - User-facing overview
- `kernel/IMPLEMENTATION_GUIDE.md` - Implementation details
- Inline code documentation

### Governance Compliance

All contributions must comply with:
- **Protected Spine**: Changes must not violate `kernel/SB688_KERNEL.md` directives
- **VERA Protocol**: High-impact changes require verification
- **Ledger Protocol**: State changes must be auditable
- **Healing Loop**: Error recovery must follow the cold-stitch pattern

### Review Process

1. Automated tests run on all PRs
2. Code review by maintainers
3. VERA verification for high-impact changes
4. Ledger entry for accepted changes
5. Merge to main branch

### Brick Isolation Pattern

When adding new functionality:

```python
# Define clear boundaries
class NewBrick:
    def __init__(self, brick_id: int, data: dict):
        self.brick_id = brick_id
        self.data = data
        self.state = "operational"

    def verify_integrity(self) -> bool:
        # Implement verification
        pass
```

### VERA Integration

For operations requiring verification:

```python
from kernel.VERA_GATE_RUNTIME import VERAGate

vera = VERAGate()
result = vera.scan_output(
    candidate=output,
    context=context,
    threshold=0.8
)
if not result["allowed"]:
    # Handle blocked operation
    pass
```

### Ledger Entries

For state changes:

```python
from kernel.LEDGER_STORE import LedgerStore

ledger = LedgerStore()
ledger.append(
    event_type="FEATURE_ADDED",
    message="Description of change",
    data={"details": "..."}
)
```

## Project Structure

```
sb688-public/
├── kernel/              # Core kernel components
├── nodes/               # Node and brick implementations
├── examples/            # Usage examples
├── tests/               # Test suite
├── governance/          # Governance documents
├── deploy/              # Deployment configurations
└── docs/                # Additional documentation
```

## Questions?

- Open a discussion on GitHub
- Review existing documentation
- Check the implementation guide

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Attribution

Contributors will be acknowledged in release notes and the project README.
