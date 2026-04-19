FROM python:3.11-slim

WORKDIR /app

COPY kernel/ ./kernel/
COPY nodes/ ./nodes/
COPY deploy/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY deploy/start_node.py .

CMD ["python", "start_node.py"]
