# Social Manager appliance self-heal

Release `1.0.0-alpha.11` keeps nginx and all application processes under one
container lifecycle while preventing a dead Nest API from leaving the appliance
permanently `Up` behind a 502 response.

## Recovery chain

1. PM2 Runtime restarts a crashed backend with a bounded delay and backoff.
2. The watchdog probes Nest directly on port 3000. Any HTTP response proves that
   Nest is serving; dependency readiness is evaluated separately by the health
   payload.
3. After six failed probes (30 seconds by default), the watchdog restarts Nest.
4. After three unsuccessful recovery cycles, it terminates PID 1 so Docker,
   Aspire or Kubernetes can restart the appliance according to its policy.

The defaults can be tuned with the `HAPPYM_BACKEND_WATCHDOG_*` environment
variables declared in `var/docker/backend-watchdog.cjs`.

## Health contract

`GET /api/internal/happym/appliance/health/` remains unauthenticated and returns
HTTP 200 when Nest is reachable. A dependency that is still starting is reported
as `ready: false` with `reason`, `reasonCode` and `remediationHint`.

If Nest itself cannot accept a request, nginx returns HTTP 503 JSON instead of an
HTML 502 response:

```json
{
  "ready": false,
  "reasonCode": "nest_down",
  "remediationHint": "self_heal_in_progress"
}
```

The image health check requires HTTP 200 and `ready: true`. Consumer SDKs may
continue reading the previous fields because the new JSON members are additive.

## Mastra PostgreSQL initialization

All concurrent calls in a Nest process share one initialization promise. A
PostgreSQL advisory lock also serializes Mastra DDL across processes connected to
the same database. The lock is always released and a failed initialization can
be retried cleanly; secrets and database connection details are never logged.
