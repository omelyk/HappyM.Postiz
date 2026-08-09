# HappyM change log

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
