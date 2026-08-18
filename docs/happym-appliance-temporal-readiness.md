# Social Manager Temporal readiness

The appliance owns two Temporal search attributes: `organizationId` and
`postId`. They are registered as `KEYWORD`, because both are identifiers used
for exact matching. This avoids consuming Temporal/Elasticsearch's small custom
`TEXT` quota.

At startup the appliance:

1. lists the namespace search attributes;
2. migrates only the two appliance-owned attributes from legacy `TEXT` to
   `KEYWORD`, when required;
3. adds either missing attribute as `KEYWORD`;
4. records a stable readiness result without throwing out of Nest bootstrap.

The appliance does not remove `CustomStringField`, `CustomTextField`, or other
attributes owned by Temporal or another application.

If Temporal rejects the operation, Nest and the unauthenticated health endpoint
remain online. `GET /internal/happym/appliance/health` returns HTTP 200 with
`ready=false` and `reason=temporal_search_attributes_unavailable`. M2M mutation
endpoints return HTTP 503 with the same JSON fields until a subsequent healthy
restart completes registration. No raw Temporal error or secret is returned.

## Smoke

1. Start the stack with a namespace containing the auto-setup `Custom*` Text
   attributes.
2. Verify `organizationId` and `postId` are `Keyword` using Temporal CLI.
3. Verify `/api/internal/happym/appliance/health` returns HTTP 200 and
   `ready=true`.
4. Call credentials rotate and admin password reset with valid M2M credentials;
   both must return 2xx.
5. Simulate an unavailable/quota-rejecting operator service, restart only the
   backend, and verify health remains HTTP 200/`ready=false` while mutations
   return structured HTTP 503 rather than nginx HTML 502.
