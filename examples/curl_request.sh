#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://api.example.com/v1/chat/completions}"
API_KEY="${API_KEY:-REPLACE_WITH_KEY}"
MODEL="${MODEL:-gpt-4.1}"

SYSTEM_PROMPT="$(cat examples/sb688_system_prompt.txt)"

curl -sS "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<JSON
{
  "model": "$MODEL",
  "messages": [
    {"role": "system", "content": $(python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<< "$SYSTEM_PROMPT")},
    {"role": "user", "content": "Apply SB-688 verification to this request."}
  ]
}
JSON
