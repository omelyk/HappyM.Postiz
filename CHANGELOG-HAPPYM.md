# HappyM change log

## 1.0.0-beta.6 - 2026-08-31

Studio-Render-WebM-UAT-Fail: Warning
- Breaking: no; the native YouTube publish and SDK contracts are unchanged.
- Fixed local appliance media resolution when the database stores an absolute Social Manager `/uploads/...` URL, while preserving remote-storage URLs and rejecting path traversal.
- Upgraded the appliance runtime to Node.js 22.23.1 and disabled the unstable optimizing compiler for backend/orchestrator build and runtime after reproducing the V8 `unreachable code` / `Illegal instruction` crash.
- Reworked backend watchdog recovery to terminate the container cleanly after sustained failure instead of starting a competing PM2 daemon that could produce `EADDRINUSE` and an extended `nest_down` outage.
- Evidence: media normalizer Jest suite 9/9, watchdog Node suite 2/2, complete appliance Docker build, healthy four-process runtime with zero restarts and no fatal/V8/address-conflict log signatures.
- Joint HappyM.Pharma unlisted YouTube UAT remains required before production promotion; no external video was published by this release task.

## 1.0.0-beta.5 - 2026-08-26

PrePublish-Render-Hook: Warning
- Contract version: `prepublish-render/v1`
- Breaking: no
- Gate enforce: yes (must block publish without attach)
- Test evidence: durable gate Jest suite (lease/double claim/double attach/consumer kill/restart/tenant/recurrence), typed SDK tests on .NET 8/9, backend and orchestrator production builds.
- Added organization-scoped render occurrences, expiring claim leases, idempotent rendered-media attach, Temporal V107 gating and a second guard at the provider mutation boundary.
- Known limit: one target per occurrence; joint Pharma/Docker/Temporal UAT remains required, so consumer enablement must use a feature flag.

## 1.0.0-beta.4 - 2026-08-22

- Added a 30-minute nginx timeout exclusively for the native YouTube publish mutation so WebM normalization plus resumable upload is not cut off by the general 90-second API timeout.
- Explicitly disabled upstream replay for the long-running publish mutation and forwarded only the required tenant, authorization and correlation headers.
- Coordinated the appliance with `Postiz.NET` and `HappyM.Pharma.Postiz.*` `1.0.0-beta.4` after the WebM implementation introduced in beta.3.

## 1.0.0-beta.3 - 2026-08-22

- Accepted tenant-owned Media Studio WebM renders in the native YouTube publishing route and normalized them server-side to MP4/H.264 with optional AAC audio before resumable upload.
- Kept MP4 inputs on the zero-copy path and removed every temporary transcode artifact after success or failure without changing the CRM media reference.
- Added safe `media_transcode_failed` (422) and `media_format_unsupported` (400) contracts without returning ffmpeg output, paths or stack details.
- Added ffmpeg only to the private appliance image and coordinated `Postiz.NET` and `HappyM.Pharma.Postiz.*` `1.0.0-beta.3`; private Vue remains `1.0.0-alpha.16`.

## 1.0.0-beta.2 - 2026-08-22

- Added native organization-scoped YouTube video and Shorts publishing through `POST /public/v1/posts/youtube/publish`, reusing the resumable upload engine.
- Restricted video and thumbnail resolution to media owned by the authenticated organization and added stable semantic errors for missing video, OAuth scopes and rejected thumbnails.
- Added `youtube.force-ssl` to new YouTube grants for custom thumbnail support without requesting broad channel-management or partner scopes.
- Coordinated the image with `HappyM.Pharma.Postiz.*` and `Postiz.NET` `1.0.0-beta.2`; the private Vue package remains `1.0.0-alpha.16` because its contract is unchanged.

## 1.0.0-beta.1 - 2026-08-18

- Consolidated the complete Social Manager appliance, embed, workspace, native API and Mastra self-healing line onto the current Postiz `main` branch.
- Preserved the newer upstream authentication/Sentry, organization selector, recurring-post and translation changes while retaining HappyM tenant isolation and CRM contracts.
- Promoted the validated alpha line to the first official beta image; private Vue remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.18` and Postiz.NET remains `1.0.0-alpha.11`.

## 1.0.0-alpha.26 - 2026-08-17

- Added a serialized Mastra PostgreSQL preflight that detects an exhausted `mastra_ai_spans` observability table and recreates only that disposable trace table before normal initialization.
- Made warm starts idempotent and verified repeated initialization without accumulating retired PostgreSQL column slots.
- Kept Social Manager available when a blocked schema repair cannot complete, exposing the structured `mastra_pg_schema` readiness reason and returning HTTP 503 for dependent AI operations without logging provider details.
- Private Vue remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.18` and Postiz.NET remains `1.0.0-alpha.11`.

## 1.0.0-alpha.25 - 2026-08-13

- Added organization-scoped Public API routes to list and soft-delete media while preserving the existing upload contracts.
- Added native M2M AI chat message/thread routes backed by the existing Mastra agent and memory, without browser cookies or embed sessions.
- Enforced thread ownership at the pharmacy organization boundary and returned stable structured error codes without logging prompts or provider errors.
- Private Vue remains `1.0.0-alpha.16`, NuGet advances to `1.0.0-alpha.18` and Postiz.NET advances to `1.0.0-alpha.11`.

## 1.0.0-alpha.24 - 2026-08-13

- Added the coordinated direct Workspace bootstrap contract for `/launches` and `/media`, avoiding the intermediate Composer navigation while retaining the single-use ticket exchange.
- Limited transparent styling to the embedded shell and made custom and Mantine modal, drawer, popover and media-picker surfaces opaque, including portal-mounted overlays.
- Replaced the standalone Composer viewport height with a constrained full-height layout so nested dialogs remain visible and usable inside the CRM iframe.
- Private Vue remains `1.0.0-alpha.16`, NuGet advances to `1.0.0-alpha.17` and Postiz.NET remains `1.0.0-alpha.10`.

## 1.0.0-alpha.23 - 2026-08-12

- Propagated the constrained iframe height through every standalone Composer wrapper, from `AppLayout` through the preview, modal-manager and content roots.
- Added opt-in `fillViewport` flex contracts with `min-height: 0`, full width/height and overflow containment, preventing editor and preview columns from collapsing behind the toolbar.
- Ensured the embed document/root chain has full height while preserving the `chrome=host`, CRM theme/language and authenticated bootstrap behavior from `1.0.0-alpha.22`.
- Private Vue remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10`.

## 1.0.0-alpha.22 - 2026-08-12

- Added a real host-chrome Composer mode driven by `chrome=host`, `embedChrome=host`, `embed.hostUi` or `embed.init`, hiding the redundant Social Manager titles and close control.
- Replaced viewport and negative-offset sizing with a constrained `100%` iframe layout, removing forced black/full-bleed backgrounds and adapting the editor/preview columns to the CRM modal.
- Extended host preference precedence to `culture` and runtime host UI messages while preserving light/dark and IT/EN values through the post-exchange redirect.
- Private Vue remains `1.0.0-alpha.16`, NuGet remains `1.0.0-alpha.13` and Postiz.NET remains `1.0.0-alpha.10`.

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
