# HappyM public API boundary

HappyM integrations use only authenticated `/public/v1` routes. Dashboard,
billing, team administration, browser sessions and Copilot APIs are outside the
integration boundary.

`GET /public/v1/version` returns the fork/upstream versions and capabilities.
`GET /public/v1/providers` returns every provider registered by the pinned fork,
including flags for external URL, browser-extension and Web3 onboarding.
Provider-specific post fields remain schema-driven and are available through
`GET /public/v1/integration-settings/:id`.

The public surface also includes provider OAuth URLs, channel settings and
deletion, notifications, media/video functions, post reconciliation by release
ID, analytics and webhook CRUD.

## Webhook signature

Set `HAPPYM_WEBHOOK_SIGNING_SECRET` in the secret manager. Postiz signs the exact
UTF-8 body using:

```text
HMAC-SHA256(secret, "{timestamp}.{body}")
```

Headers:

- `X-HappyM-Webhook-Timestamp`: Unix seconds;
- `X-HappyM-Webhook-Signature`: `sha256=<lowercase hex digest>`.

Consumers must reject missing signatures, timestamps outside the configured
clock-skew window and replayed signatures. Verification must use a constant-time
comparison and the raw request body before JSON parsing.
