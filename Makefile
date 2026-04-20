.PHONY: test test-coverage run demo docker-up docker-down docker-logs clean all

test:
	python -m pytest tests/ -v --tb=short

test-coverage:
	python -m pytest tests/ --cov=kernel --cov=nodes --cov-report=html

run:
	python examples/run_live_demo.py

demo:
	python examples/run_live_demo.py && cat proof.json

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
