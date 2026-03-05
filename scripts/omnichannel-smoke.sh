#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_URL="${OPENCLAW_URL:-http://127.0.0.1:8082}"

run_case() {
  local case_name="$1"
  local payload="$2"

  echo "[$case_name] Calling ${OPENCLAW_URL}/chat ..."
  local resp
  resp="$(curl -sS -m 20 -H 'Content-Type: application/json; charset=utf-8' -d "${payload}" "${OPENCLAW_URL}/chat")"
  echo "${resp}"

  echo "${resp}" | grep -q '"ok":true'
  echo "${resp}" | grep -q '"reply":"'
  echo "${resp}" | grep -q '"ui":{"type":"menu"'
  echo "${resp}" | grep -q '"suggestions":\[{'
}

run_case "1/4 web-text" \
  '{"userId":"omni-web-smoke","message":"xem menu","channel":"web","clientContext":{"sourceMessageId":"web-smoke-1","locale":"vi-VN"}}'

run_case "2/4 messenger-action" \
  '{"userId":"omni-msg-smoke","message":"","actionPayload":"ACTION_VIEW_MENU","channel":"messenger","clientContext":{"sourceMessageId":"msg-smoke-1","locale":"vi-VN"}}'

run_case "3/4 telegram-text" \
  '{"userId":"omni-telegram-smoke","message":"xem menu","channel":"telegram","clientContext":{"sourceMessageId":"tg-smoke-1","locale":"vi-VN"}}'

run_case "4/4 web-action-order" \
  '{"userId":"omni-web-smoke","message":"","actionPayload":"ACTION_ORDER_START","channel":"web","clientContext":{"sourceMessageId":"web-smoke-2","locale":"vi-VN"}}'

echo "PASS: omnichannel smoke test passed."
