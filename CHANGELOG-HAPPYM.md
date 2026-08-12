# HappyM change log

## 1.0.0-alpha.13 - 2026-08-12

- Added tenant-scoped `workspace` embed sessions with direct allow-listed landings on `/launches` and `/media`.
- Reused the opaque single-use ticket exchange and pharmacy organization/user mapping without routing through the composer.
- Added purpose- and landing-specific API restrictions so workspace sessions cannot reach account administration or Connect OAuth endpoints.
- Coordinated the image with `HappyM.Pharma.Postiz.*` and `@omelyk/happym-postiz-vue` `1.0.0-alpha.13`; `Postiz.NET` remains `1.0.0-alpha.10`.

## 1.0.0-alpha.12 - 2026-08-11

- Added the YouTube-only `YOUTUBE_REDIRECT_URI` override without changing the public Social Manager host used by other providers.
- Applied the effective redirect consistently to Google OAuth client construction, authorization URL generation and authorization-code exchange.
- Exposed the effective YouTube callback through the appliance provider-status endpoint without returning OAuth secrets.
- Documented the localhost UAT callback and the exact-match requirement in Google Cloud Console; private NuGet/npm SDK versions remain `1.0.0-alpha.10`.

## 1.0.0-alpha.11 - 2026-08-11

- Prevented concurrent Mastra PostgreSQL schema initialization with a shared single-flight promise and a database advisory lock, eliminating the observed duplicate-key cold-start crash.
- Replaced the detached PM2 startup with `pm2-runtime`, controlled restart/backoff policies and a direct Nest watchdog that escalates irrecoverable failures to the container orchestrator.
- Converted nginx upstream 502/504 responses into a branded structured 503 contract and added a readiness-aware Docker health check.
- Extended appliance readiness payloads with stable `reasonCode` and `remediationHint` fields while retaining the existing `reason` field for backward compatibility.

## 1.0.0-alpha.10 - 2026-08-11

- Migrated the appliance-owned Temporal `organizationId` and `postId` search attributes from quota-constrained Text to exact-match Keyword.
- Made Temporal search-attribute bootstrap fail-soft so Nest remains online instead of leaving nginx on a permanent 502.
- Added explicit appliance readiness reasons and structured 503 responses for M2M mutations while Temporal is unavailable.
- Coordinated the image with Postiz.NET and HappyM.Pharma.Postiz package `1.0.0-alpha.10`, including structured Social Manager API errors.

## 1.0.0-alpha.9 - 2026-08-10

- Rebranded appliance login, sidebar, favicon and primary page titles as Social Manager using versioned NetForges assets.
- Kept public frontend, backend and Meta OAuth URLs driven by `FRONTEND_URL`, `MAIN_URL` and `NEXT_PUBLIC_BACKEND_URL`; removed the legacy host from smoke guidance.
- Replaced the Instagram Business empty-state with actionable Meta Page-to-Instagram instructions in Italian and English.
- Made the active pharmacy workspace explicit in the top bar, with code/display name, a separately labelled system workspace and a system-workspace empty-state.
- Preserved signed Connect ticket tenant isolation; NuGet/npm SDK versions remain `1.0.0-alpha.7` because their contracts did not change.

## 1.0.0-alpha.8 - 2026-08-10

- Added a server-rendered Social Manager settings landing for appliance administrators.
- Redirected the authenticated appliance home to the stable settings console.
- Limited `/launches` popup closing to explicit OAuth result callbacks.
- Added settings RSC and browser smoke-test guidance.

## 1.0.0-alpha.7 - 2026-08-09

- Added M2M provider status and immediate Meta OAuth app hot-apply.
- Accepted canonical and Pharma-prefixed Facebook environment variables at startup.
- Sent a whitelabel `provider_not_configured` event to the CRM without leaking secrets or internal branding.

## 1.0.0-alpha.6 - 2026-08-09

- Enforced the CRM Connect no-login invariant across proxy and browser API failures.
- Added explicit bilingual session/provider errors with a close action.
- Added appliance OAuth credential validation before starting provider flows.

## 1.0.0-alpha.5 - 2026-08-08

- Fixed Connect exchange to derive purpose/provider from the authoritative CRM ticket.
- Kept optional browser hints as consistency checks and preserved composer isolation.
- Added regression coverage for minimal Connect exchange payloads and conflicting hints.

## 1.0.0-alpha.1 - Unreleased

- Fork baseline pinned to Postiz v2.23.0.
- Added the HappyM fullscreen composer route and iframe v1 bridge.
- Added opaque ticket exchange and short-lived scoped embed sessions.
- Added integration allow-list enforcement and an embed API deny-by-default
  policy.
- Added focused SSO, replay, origin and tenant-isolation tests.
