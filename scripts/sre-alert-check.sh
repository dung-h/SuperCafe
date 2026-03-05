#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_URL="${OPENCLAW_URL:-http://127.0.0.1:8082}"
WINDOW_MINUTES="${WINDOW_MINUTES:-5}"

MAX_FALLBACK_RATE="${MAX_FALLBACK_RATE:-12}"
MAX_ACTION_ERROR_RATE="${MAX_ACTION_ERROR_RATE:-3}"
MIN_ORDER_COMPLETION_RATE="${MIN_ORDER_COMPLETION_RATE:-55}"
MIN_ORDER_START_COUNT_FOR_COMPLETION_ALERT="${MIN_ORDER_START_COUNT_FOR_COMPLETION_ALERT:-5}"
MAX_WEBHOOK_SEND_FAIL_RATE="${MAX_WEBHOOK_SEND_FAIL_RATE:-3}"
MAX_DB_ERROR_RATE="${MAX_DB_ERROR_RATE:-1}"

float_gt() {
  awk -v left="$1" -v right="$2" 'BEGIN { exit !(left > right) }'
}

float_lt() {
  awk -v left="$1" -v right="$2" 'BEGIN { exit !(left < right) }'
}

failures=0

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[alert] missing command: $1" >&2
    exit 2
  fi
}

require_cmd curl
require_cmd jq
require_cmd docker

echo "[alert] window=${WINDOW_MINUTES}m openclaw=${OPENCLAW_URL}"

kpi_raw="$(curl -fsS "${OPENCLAW_URL}/admin/kpi/summary?windowMinutes=${WINDOW_MINUTES}" || true)"
if [ -z "${kpi_raw}" ]; then
  echo "[alert] FAIL: cannot fetch KPI summary" >&2
  exit 1
fi

kpi_ok="$(printf '%s' "${kpi_raw}" | jq -r '.ok // false')"
if [ "${kpi_ok}" != "true" ]; then
  err_msg="$(printf '%s' "${kpi_raw}" | jq -r '.error // "unknown_error"')"
  echo "[alert] FAIL: KPI endpoint not ready: ${err_msg}" >&2
  exit 1
fi

overall_total="$(printf '%s' "${kpi_raw}" | jq -r '.data.overall.counters.totalBotEvents // 0')"
fallback_rate="$(printf '%s' "${kpi_raw}" | jq -r '.data.overall.rates.fallbackRate // 0')"
action_error_rate="$(printf '%s' "${kpi_raw}" | jq -r '.data.overall.rates.actionErrorRate // 0')"
order_completion_rate="$(printf '%s' "${kpi_raw}" | jq -r '.data.overall.rates.orderWizardCompletionRate // 0')"
order_start_count="$(printf '%s' "${kpi_raw}" | jq -r '.data.overall.counters.orderStartCount // 0')"

echo "[alert] KPI totalBotEvents=${overall_total} fallbackRate=${fallback_rate}% actionErrorRate=${action_error_rate}% orderCompletion=${order_completion_rate}%"

if float_gt "${fallback_rate}" "${MAX_FALLBACK_RATE}"; then
  echo "[alert] FAIL: fallback_rate ${fallback_rate}% > ${MAX_FALLBACK_RATE}%" >&2
  failures=$((failures + 1))
fi

if float_gt "${action_error_rate}" "${MAX_ACTION_ERROR_RATE}"; then
  echo "[alert] FAIL: action_error_rate ${action_error_rate}% > ${MAX_ACTION_ERROR_RATE}%" >&2
  failures=$((failures + 1))
fi

if [ "${order_start_count}" -ge "${MIN_ORDER_START_COUNT_FOR_COMPLETION_ALERT}" ]; then
  if float_lt "${order_completion_rate}" "${MIN_ORDER_COMPLETION_RATE}"; then
    echo "[alert] FAIL: order_completion_rate ${order_completion_rate}% < ${MIN_ORDER_COMPLETION_RATE}% (orderStartCount=${order_start_count})" >&2
    failures=$((failures + 1))
  fi
else
  echo "[alert] SKIP: order_completion_rate check requires orderStartCount >= ${MIN_ORDER_START_COUNT_FOR_COMPLETION_ALERT} (current=${order_start_count})"
fi

webhook_lines="$(docker logs --since "${WINDOW_MINUTES}m" lowland_app 2>&1 | grep '\[messenger\] webhook processed' || true)"
processed_sum=0
send_failed_sum=0
if [ -n "${webhook_lines}" ]; then
  processed_sum="$(printf '%s\n' "${webhook_lines}" | awk '{
    for (i = 1; i <= NF; i++) {
      if ($i ~ /^processed=/) { split($i, a, "="); p += a[2] + 0; }
      if ($i ~ /^sendFailed=/) { split($i, a, "="); s += a[2] + 0; }
    }
  } END { printf "%d", p + 0 }')"
  send_failed_sum="$(printf '%s\n' "${webhook_lines}" | awk '{
    for (i = 1; i <= NF; i++) {
      if ($i ~ /^sendFailed=/) { split($i, a, "="); s += a[2] + 0; }
    }
  } END { printf "%d", s + 0 }')"
fi

webhook_send_fail_rate="0"
if [ "${processed_sum}" -gt 0 ]; then
  webhook_send_fail_rate="$(awk -v s="${send_failed_sum}" -v p="${processed_sum}" 'BEGIN { printf "%.2f", (s * 100) / p }')"
fi

echo "[alert] webhook processed=${processed_sum} sendFailed=${send_failed_sum} sendFailRate=${webhook_send_fail_rate}%"

if [ "${processed_sum}" -gt 0 ] && float_gt "${webhook_send_fail_rate}" "${MAX_WEBHOOK_SEND_FAIL_RATE}"; then
  echo "[alert] FAIL: webhook send_fail_rate ${webhook_send_fail_rate}% > ${MAX_WEBHOOK_SEND_FAIL_RATE}%" >&2
  failures=$((failures + 1))
fi

db_error_count="$(docker logs --since "${WINDOW_MINUTES}m" openclaw_agent 2>&1 | awk '/failed to write chat_dialogue_events|dialogue session cleanup failed|dialogue engine v2 failed; fallback to legacy/ { c++ } END { printf "%d", c + 0 }')"
if [ "${overall_total}" -gt 0 ]; then
  db_error_rate="$(awk -v e="${db_error_count}" -v t="${overall_total}" 'BEGIN { printf "%.2f", (e * 100) / t }')"
else
  if [ "${db_error_count}" -gt 0 ]; then
    db_error_rate="100.00"
  else
    db_error_rate="0.00"
  fi
fi

echo "[alert] dbErrors=${db_error_count} dbErrorRate=${db_error_rate}%"
if float_gt "${db_error_rate}" "${MAX_DB_ERROR_RATE}"; then
  echo "[alert] FAIL: db_error_rate ${db_error_rate}% > ${MAX_DB_ERROR_RATE}%" >&2
  failures=$((failures + 1))
fi

if [ "${failures}" -gt 0 ]; then
  echo "[alert] FAILED (${failures} threshold breach(es))" >&2
  exit 1
fi

echo "[alert] OK"
