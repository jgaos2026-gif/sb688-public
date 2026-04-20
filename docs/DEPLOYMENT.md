# SB-688 Deployment Guide

This guide covers deployment scenarios for the SB-688 Sovereign Alignment Kernel.

## Quick Start

### Local Development
```bash
# Install dependencies
pip install -r tests/requirements.txt

# Run demo
python sb688.py demo

# Run tests
python sb688.py test

# Verify system
python sb688.py verify
```

## Deployment Options

### 1. Single-Node Deployment

For development, testing, or low-scale production:

```bash
# Run the live demo
make run

# Or use the CLI
python sb688.py demo
```

### 2. Multi-Node Docker Deployment

For distributed, fault-tolerant production environments:

```bash
# Start 5-node cluster
make docker-up

# Check cluster status
curl http://localhost:5000/status
curl http://localhost:5001/status
curl http://localhost:5002/status
curl http://localhost:5003/status
curl http://localhost:5004/status

# Test resilience
curl -X POST http://localhost:5000/corrupt
curl -X POST http://localhost:5000/heal

# View ledger
curl http://localhost:5000/ledger

# Stop cluster
make docker-down

# View logs
make docker-logs
```

### 3. API Integration

Integrate SB-688 into existing systems via API:

```bash
# Set environment variables
export API_URL="https://your-api-endpoint.com/v1/chat/completions"
export API_KEY="your-api-key"
export MODEL="gpt-4.1"

# Use the system prompt
bash examples/curl_request.sh
```

### 4. Python Library Integration

Use SB-688 as a Python library:

```python
from kernel.SB688_ENGINE import SB688Engine
from kernel.VERA_GATE_RUNTIME import VERAGate

# Initialize
engine = SB688Engine()
vera = VERAGate()

# Run operations
result = vera.scan_output(
    candidate="Your output here",
    context={"verified": True},
    threshold=0.8
)

# Check integrity
health = engine.health()
status = engine.braid_status()
```

## Environment Configuration

### Required Environment Variables

For Docker deployment:
- `NODE_ID` - Unique node identifier (0-4)
- `PEER_NODES` - Comma-separated list of peer node names

For API integration:
- `API_URL` - API endpoint URL
- `API_KEY` - Authentication key
- `MODEL` - Model identifier

### Optional Configuration

- `LOG_LEVEL` - Logging verbosity (DEBUG, INFO, WARNING, ERROR)
- `LEDGER_PATH` - Path to ledger storage
- `CHECKPOINT_INTERVAL` - Checkpoint frequency in seconds

## Production Considerations

### Security

1. **API Keys**: Never commit API keys. Use environment variables or secret management.
2. **Network**: Use TLS for inter-node communication in production.
3. **Access Control**: Implement authentication/authorization for API endpoints.
4. **Audit Logs**: Store ledger in secure, append-only storage.

### Scaling

1. **Horizontal Scaling**: Add more nodes to the Docker cluster.
2. **Load Balancing**: Use nginx or cloud load balancer.
3. **Database**: Consider using external ledger storage (PostgreSQL, S3).

### Monitoring

Monitor these metrics:
- Node health percentage
- Braid status (GREEN/YELLOW/RED)
- Healing loop invocations
- VERA pass/fail rates
- Ledger growth rate
- Detection latency
- Recovery time

### Backup and Recovery

1. **Ledger Backup**: Regularly backup ledger files
2. **Kernel Backup**: Version control kernel documents
3. **Checkpoint Strategy**: Configure appropriate checkpoint intervals
4. **Disaster Recovery**: Test recovery procedures regularly

## Health Checks

Implement health checks for production monitoring:

```bash
# HTTP health check
curl http://localhost:5000/status

# Expected response
{
  "node_id": 0,
  "health": 100.0,
  "braid_status": "GREEN",
  "timestamp": "2026-04-20T09:00:00Z"
}
```

## Troubleshooting

### Health Below 100%

```bash
# Run healing loop
python sb688.py heal

# Or via API
curl -X POST http://localhost:5000/heal
```

### Braid Status RED

Indicates corruption detected:
1. Review recent ledger entries
2. Identify corruption source
3. Run healing loop
4. Verify recovery with `python sb688.py verify`

### Node Communication Failure

For Docker deployment:
1. Check network connectivity: `docker network inspect sb688-network`
2. Verify peer configuration
3. Check logs: `make docker-logs`

### Tests Failing

```bash
# Run tests with verbose output
python -m pytest tests/ -v --tb=long

# Run specific test
python -m pytest tests/test_integration.py::test_full_system_lifecycle -v
```

## Performance Tuning

### Optimization Tips

1. **Brick Count**: Optimal range is 50-100 bricks per engine
2. **Checkpoint Frequency**: Balance between performance and recovery granularity
3. **VERA Threshold**: Higher threshold = stricter verification = slower but safer
4. **Ledger Storage**: Use SSD for better I/O performance

### Benchmarks

Typical performance (single node, Python 3.11):
- Detection time: <1ms
- Healing time: 3-5ms for 99.8% corruption
- VERA scan: <10ms per verification
- Ledger append: <1ms per entry

## Deployment Checklist

- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Test locally with `make demo`
- [ ] Run full test suite with `make test`
- [ ] Verify system integrity
- [ ] Configure monitoring
- [ ] Set up backup strategy
- [ ] Document node configuration
- [ ] Test disaster recovery
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Monitor initial operations

## Support

For deployment issues:
- Review [Implementation Guide](kernel/IMPLEMENTATION_GUIDE.md)
- Check [Contributing Guide](CONTRIBUTING.md)
- Open an issue on GitHub
