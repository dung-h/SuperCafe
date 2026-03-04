#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_URL:-http://127.0.0.1:9999}"
WEBHOOK_PATH="${WEBHOOK_PATH:-/?r=messenger/webhook}"
VERIFY_TOKEN="${MESSENGER_VERIFY_TOKEN:-010705}"
APP_SECRET="${MESSENGER_APP_SECRET:-}"
LOWLAND_CONTAINER="${LOWLAND_CONTAINER:-lowland_app}"
AUTO_DOCKER_ENV="${AUTO_DOCKER_ENV:-1}"

read_container_env() {
  local key="$1"
  docker exec "${LOWLAND_CONTAINER}" printenv "${key}" 2>/dev/null || true
}

if [[ "${AUTO_DOCKER_ENV}" == "1" ]]; then
  if docker ps --format '{{.Names}}' | grep -qx "${LOWLAND_CONTAINER}"; then
    if [[ -z "${MESSENGER_VERIFY_TOKEN:-}" ]]; then
      CONTAINER_VERIFY_TOKEN="$(read_container_env MESSENGER_VERIFY_TOKEN)"
      if [[ -n "${CONTAINER_VERIFY_TOKEN}" ]]; then
        VERIFY_TOKEN="${CONTAINER_VERIFY_TOKEN}"
      fi
    fi
    if [[ -z "${MESSENGER_APP_SECRET:-}" ]]; then
      CONTAINER_APP_SECRET="$(read_container_env MESSENGER_APP_SECRET)"
      if [[ -n "${CONTAINER_APP_SECRET}" ]]; then
        APP_SECRET="${CONTAINER_APP_SECRET}"
      fi
    fi
  fi
fi

BASE_WEBHOOK_URL="${WEB_URL%/}${WEBHOOK_PATH}"
CHALLENGE="$(date +%s)"
MID="mid.smoke.$(date +%s%N)"
PAYLOAD_FILE="$(mktemp)"
cleanup() {
  rm -f "${PAYLOAD_FILE}"
}
trap cleanup EXIT

cat >"${PAYLOAD_FILE}" <<JSON
{"object":"page","entry":[{"messaging":[{"sender":{"id":"777777"},"recipient":{"id":"999999"},"timestamp":1700000012345,"message":{"mid":"${MID}","text":"xem menu"}}]}]}
JSON

make_sig_header() {
  if [[ -z "${APP_SECRET}" ]]; then
    return 0
  fi
  local digest
  digest="$(openssl dgst -sha256 -hmac "${APP_SECRET}" "${PAYLOAD_FILE}" | awk '{print $2}')"
  printf 'X-Hub-Signature-256: sha256=%s' "${digest}"
}

echo "[1/3] Verifying GET challenge ..."
VERIFY_RESP="$(curl -sS -m 15 "${BASE_WEBHOOK_URL}&hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${CHALLENGE}")"
if [[ "${VERIFY_RESP}" != "${CHALLENGE}" ]]; then
  echo "FAIL: verify challenge mismatch"
  echo "Expected: ${CHALLENGE}"
  echo "Actual:   ${VERIFY_RESP}"
  exit 1
fi

echo "[2/3] Posting first event (should be processed) ..."
SIG_HEADER="$(make_sig_header || true)"
if [[ -n "${SIG_HEADER}" ]]; then
  RESP1="$(curl -sS -m 20 -H 'Content-Type: application/json' -H "${SIG_HEADER}" --data-binary @"${PAYLOAD_FILE}" "${BASE_WEBHOOK_URL}")"
else
  RESP1="$(curl -sS -m 20 -H 'Content-Type: application/json' --data-binary @"${PAYLOAD_FILE}" "${BASE_WEBHOOK_URL}")"
fi
echo "${RESP1}"

echo "${RESP1}" | grep -q '"ok":true'
echo "${RESP1}" | grep -q '"processed":1'
echo "${RESP1}" | grep -q '"duplicates":0'

echo "[3/3] Posting same event again (should be duplicate) ..."
if [[ -n "${SIG_HEADER}" ]]; then
  RESP2="$(curl -sS -m 20 -H 'Content-Type: application/json' -H "${SIG_HEADER}" --data-binary @"${PAYLOAD_FILE}" "${BASE_WEBHOOK_URL}")"
else
  RESP2="$(curl -sS -m 20 -H 'Content-Type: application/json' --data-binary @"${PAYLOAD_FILE}" "${BASE_WEBHOOK_URL}")"
fi
echo "${RESP2}"

echo "${RESP2}" | grep -q '"ok":true'
echo "${RESP2}" | grep -q '"processed":0'
echo "${RESP2}" | grep -q '"duplicates":1'

echo "PASS: messenger webhook smoke test passed."
