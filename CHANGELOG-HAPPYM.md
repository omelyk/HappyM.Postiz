# HappyM change log

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
