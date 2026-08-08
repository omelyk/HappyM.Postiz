# HappyM embed SSO

1. HappyM validates the current user, tenant and pharmacy and creates a random
   ticket with a maximum lifetime of 60 seconds. Only its hash is persisted.
2. HappyM opens `/embed/happym/composer?ticket=<opaque>`.
3. The browser posts the ticket to `/happym/embed-sessions/exchange`.
4. HappyM.Postiz sends it to `HAPPYM_EMBED_EXCHANGE_URL` using the configured
   client ID and bearer secret. The extension consumes it atomically.
5. HappyM.Postiz validates expiry, return origin, active Postiz user,
   organization membership and every allowed integration.
6. Postiz sets `auth`, `showorg` and `happym_embed` as HttpOnly cookies. In
   production they are `Secure; SameSite=None`.
7. The browser uses `location.replace` to remove the ticket from history and
   reloads the clean composer URL.

The extension response must contain:

```json
{
  "postizUserId": "...",
  "postizOrganizationId": "...",
  "tenantId": "...",
  "pharmacyId": "...",
  "userId": "...",
  "allowedIntegrationIds": ["..."],
  "origin": "https://crm.happym.example",
  "correlationId": "...",
  "expiresAt": "2026-08-08T10:01:00Z"
}
```

The exchange preserves `400`, `401`, `403`, `409` and `410` statuses returned by
HappyM. A `409` indicates replay and `410` an expired ticket. Production should
also restrict the internal endpoint at the network layer or use mTLS.
