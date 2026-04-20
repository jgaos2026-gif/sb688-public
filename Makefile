.PHONY: test test-coverage run demo docker-up docker-down docker-logs clean all verify version teaser help

help:
	@echo "SB-688 Makefile Commands:"
	@echo "  make test           - Run test suite"
	@echo "  make test-coverage  - Run tests with coverage"
	@echo "  make run            - Run live demo"
	@echo "  make demo           - Run demo and show proof"
	@echo "  make verify         - Verify system integrity"
	@echo "  make teaser         - Run 10-second teaser"
	@echo "  make version        - Show version info"
	@echo "  make docker-up      - Start Docker cluster"
	@echo "  make docker-down    - Stop Docker cluster"
	@echo "  make docker-logs    - View Docker logs"
	@echo "  make clean          - Clean generated files"
	@echo "  make all            - Run tests, Docker, and demo"

test:
	python -m pytest tests/ -v --tb=short

test-coverage:
	python -m pytest tests/ --cov=kernel --cov=nodes --cov-report=html

run:
	python examples/run_live_demo.py

demo:
	python examples/run_live_demo.py && cat proof.json

verify:
	python sb688.py verify

teaser:
	python sb688.py teaser

version:
	python sb688.py version

docker-up:
	docker compose -f deploy/docker-compose.yml up -d --build

docker-down:
	docker compose -f deploy/docker-compose.yml down

docker-logs:
	docker compose -f deploy/docker-compose.yml logs -f

clean:
	rm -rf __pycache__ .pytest_cache htmlcov proof.json proof.csv
	find . -name "*.pyc" -delete

all: test docker-up demo
