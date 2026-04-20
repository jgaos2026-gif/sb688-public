# SB-688 Functional Runtime

## Run single-node demo

```bash
make run
```

## Run tests

```bash
python -m pip install -r tests/requirements.txt
make test
```

## Start 5-node docker testbed

```bash
make docker-up
curl http://localhost:5000/status
curl -X POST http://localhost:5000/corrupt
curl -X POST http://localhost:5000/heal
curl http://localhost:5000/ledger
```

### API Endpoints with Lock Protection

All sensitive operations require unlocking with code `1211`:

```bash
# Unlock sensitive access
curl -X POST http://localhost:5000/unlock \
  -H "Content-Type: application/json" \
  -d '{"code": "1211"}'

# Access sensitive state
curl http://localhost:5000/status?include_sensitive=true

# Lock sensitive access
curl -X POST http://localhost:5000/lock
```

## Export proof

The live demo writes:
- `proof.json`
- `proof.csv`

## Security: Lock 1211 Protection

All sensitive operations are protected by lock code `1211`:

**Engine-level protection:**
- `engine.get_state(include_sensitive=True)` - requires unlock
- `engine.export_proof()` - requires unlock
- Brick data is shown as "LOCKED" by default

**Node-level protection:**
- `node.get_state(include_sensitive=True)` - requires unlock
- `node.sync_state_with_peers()` - requires unlock
- `node.apply_brick_state()` - requires unlock
- `node.participate_in_healing()` - requires unlock
- `node.heartbeat()` - requires unlock (calls sync_state_with_peers)

**API-level protection:**
- `/status?include_sensitive=true` - requires unlock
- `/unlock` - POST endpoint to unlock with code
- `/lock` - POST endpoint to lock access

**Environment override:**
You can override the default code `1211` by setting `SB688_SENSITIVE_ACCESS_CODE`.
