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

## Export proof

The live demo writes:
- `proof.json`
- `proof.csv`
