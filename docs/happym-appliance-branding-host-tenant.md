# Social Manager appliance: branding, host and tenant contract

## Branding

In appliance mode (`HAPPYM_APPLIANCE_MODE=true` and
`NEXT_PUBLIC_HAPPYM_APPLIANCE_MODE=true`) the operator-facing product name is
**Social Manager**. Versioned assets under `apps/frontend/public/brand/` derive
from the official NetForges icon and include SVG/PNG wordmarks plus 32, 64 and
180 px icons.

## Public URL contract

The appliance does not hard-code a browser hostname. Deployment injects:

- `FRONTEND_URL`: canonical frontend origin, session-cookie domain source and
  Meta OAuth callback origin.
- `MAIN_URL`: canonical product origin exposed to frontend helpers.
- `NEXT_PUBLIC_BACKEND_URL`: public backend/API origin reachable by the browser.

Changing the hostname is therefore a deployment configuration change only.

## Tenant model and operator smoke

The active organization is the tenant boundary: one workspace per pharmacy,
with the pharmacy code as organization id. The system organization
(`NEXT_PUBLIC_HAPPYM_APPLIANCE_SYSTEM_ORGANIZATION_ID`, default
`happym-system`) is reserved for engine administration.

1. Sign in as SuperAdmin and verify **Workspace / Farmacia** lists pharmacy code
   plus display name for FARMA1/FARMA2 and marks the system workspace.
2. On `happym-system`, verify the explicit empty-state asks to select a pharmacy.
3. Select FARMA1 and verify only FARMA1 integrations are returned.
4. Complete embedded Connect for FARMA2, then verify FARMA1 is unchanged and
   the new integration belongs only to FARMA2.

The `/user/self`, `/user/organizations`, `/user/change-org` flow keeps the
console on one active workspace. Embedded Connect continues to derive the
organization from its signed appliance ticket.
