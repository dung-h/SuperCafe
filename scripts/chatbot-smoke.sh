#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_URL="${OPENCLAW_URL:-http://127.0.0.1:8082}"
PAYLOAD='{"userId":"web-smoke","message":"có các món nào","channel":"web"}'

echo "[1/2] Calling ${OPENCLAW_URL}/chat ..."
RESP="$(curl -sS -m 15 -H 'Content-Type: application/json; charset=utf-8' -d "${PAYLOAD}" "${OPENCLAW_URL}/chat")"
echo "${RESP}"

echo "[2/2] Verifying response contract ..."
echo "${RESP}" | grep -q '"ok":true'
echo "${RESP}" | grep -q '"reply":"'
echo "${RESP}" | grep -q '"ui":{"type":"menu"'
echo "${RESP}" | grep -q '"items":\['

echo "PASS: chatbot menu smoke test passed."
