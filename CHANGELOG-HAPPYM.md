# HappyM change log

## 1.0.0-alpha.21 - 2026-08-12

- Added CRM-controlled Composer language (`lang`/`lng`) and theme (`theme`/`mode`) normalization for Italian/English and light/dark modes.
- Preserved the normalized host preferences across the post-exchange redirect using host-only session cookies and same-host local storage, without changing authentication cookie scope.
- Applied language, document metadata and color scheme before mounting the authenticated composer shell, and kept runtime `embed.init`/`theme.changed` messages synchronized with the same policy.
- Private Vue remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10`.

## 1.0.0-alpha.20 - 2026-08-12

- Deferred the authenticated composer shell, user hydration and Copilot runtime until after the single-use ticket exchange, redirect and embed-session validation complete.
- Removed authenticated data consumers from the shared HappyM embed bootstrap layout so Composer, Connect and Workspace can initialize without premature `/user` or Copilot requests.
- Added a deterministic first-paint gate and regression coverage preventing the composer shell from mounting while a ticket is pending or the session is unvalidated, containing React hydration mismatch failures.
- Private Vue remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10`.

## 1.0.0-alpha.19 - 2026-08-12

- Aligned valid composer embed sessions with the read/API dependencies used by tags, media, third-party assets, Copilot and the authenticated user profile.
- Kept administrative endpoints denied while distinguishing an allow-list denial from an invalid or expired embed JWT.
- Made the unauthenticated embed-session user endpoint return the stable `401` JSON contract `happym_embed_session_required` before the generic Postiz auth filter can emit an empty response.
- Private Vue remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10`.

## 1.0.0-alpha.18 - 2026-08-12

- Changed auth, organization and embed cookies to host-only on `.local`, localhost, IP and other non-registrable/special-use hosts while retaining `Secure` and `SameSite=None` for HTTPS appliance embeds.
- Kept shared-domain cookies for safe ICANN/private registrable domains, preserving hosted deployments and applying the same policy to Composer, Connect and admin SSO authentication.
- Hardened the embed-session user endpoint to return a structured 401 when its session cookie/context is missing instead of throwing a 500 null dereference.
- Private Vue remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10`.

## 1.0.0-alpha.17 - 2026-08-12

- Kept the service administrator configured by `HAPPYM_APPLIANCE_ADMIN_*` as the SSO identity while provisioning the opt-in local demo SuperAdmin as a separate account.
- Granted both service and demo SuperAdmins access to CRM-provisioned pharmacy workspaces without sharing or logging either credential.
- Retained the workspace switcher and tenant glossary delivered in `1.0.0-alpha.16`; the Vue package remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10`.

## 1.0.0-alpha.16 - 2026-08-12

- Made the System-workspace CTA open an accessible, click-controlled workspace switcher instead of merely focusing a hover-only control.
- Granted the configured appliance SuperAdmin explicit membership in every CRM-provisioned pharmacy workspace, including existing workspaces during bootstrap and newly ensured workspaces at runtime.
- Added canonical Italian and English workspace terminology, system/pharmacy labels and the CRM Ensure-workspace remediation message.
- Coordinated the host-facing tenant glossary with `@omelyk/happym-postiz-vue` `1.0.0-alpha.16`; private NuGet SDKs remain `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10`.

## 1.0.0-alpha.15 - 2026-08-12

- Replaced the login's externally referenced SVG composition with the self-contained Social Manager NetForges wordmark and added an accessible NetForges appliance footer.
- Added an explicitly gated local-demo SuperAdmin hint that fills, but never submits, the login form only when appliance mode and `HAPPYM_DEV_LOGIN_HINT=true` are both enabled.
- Aligned local-demo bootstrap credentials with `HAPPYM_DEV_LOGIN_EMAIL`/`HAPPYM_DEV_LOGIN_PASSWORD`; the `superadmin` alias maps to `superadmin@happym.local` and defaults to `Demo123456` only behind the explicit dev gate.
- Private NuGet/npm SDK versions remain `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10` because their public contracts are unchanged.

## 1.0.0-alpha.14 - 2026-08-12

- Reduced the YouTube OAuth grant to the profile, email, read-only channel, upload and read-only analytics capabilities used by Social Manager.
- Removed the broad `youtube`, `youtube.force-ssl` and YouTube Partner scopes from authorization requests.
- Added an explicit scope contract and regression coverage; private NuGet/npm SDK versions remain `1.0.0-alpha.13` because their public contracts are unchanged.

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
