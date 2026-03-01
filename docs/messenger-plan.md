# Messenger Integration Plan (Stub Phase)

Current state:
- `openclaw` accepts `channel=messenger`.
- Runtime is not enabled yet; service returns a placeholder response.

## Checklist for next phase

1. Create Meta app and page access setup.
2. Add webhook endpoint in a dedicated messenger gateway service.
3. Implement verify token flow (`hub.verify_token`).
4. Validate request signature (`X-Hub-Signature-256`).
5. Convert Messenger events to unified chat payload (`userId`, `message`, `channel`).
6. Route to `openclaw /chat` with `channel=messenger`.
7. Send reply back through Messenger Send API.
8. Add retries, idempotency, and structured logs with correlation IDs.
9. Add key rotation policy for app secret/page access token.
10. Add integration tests for webhook verify + message roundtrip.

