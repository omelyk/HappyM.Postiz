# Social Manager 3.0 login

The appliance login is white with the NetForges wordmark, Social Manager logo,
customer identity and copyright footer. Original licenses and upstream notices
remain in the source distribution. The login links to that source and license.
The public `/brand/` asset directory must be accessible before authentication.

The Source successor header uses **3.0.1 :.: 2.23.0**. The first is the commercial appliance
version, distinct from API/SDK contract versions. The second is the documented
upstream baseline tag `upstream-baseline-v2.23.0`, peeled commit
`1e4c8dd5c4f70c4d0abd01e23cc42d5b533d1ab9`. The inherited `version.txt`
is not the fork's release metadata. This source version does not attest that a
successor container, customer deployment or production release has been qualified.

## Customer branding

The server runtime must receive an **absolute** `NEXT_PUBLIC_BACKEND_URL`.
Nest initializes the MCP module with `new URL('/mcp-oauth', base)`, so a runtime
value of `/api` raises `TypeError: Invalid URL` before the backend becomes ready.
The frontend may still be compiled with `/api` for same-origin requests; that
compiled client setting does not replace the server runtime requirement.

For the assigned private QA origin the runtime value is
`http://127.0.0.1:25428/api`. Customer production installations must supply their
own absolute HTTPS API URL. The customer distribution Compose already provides
an absolute loopback URL using its assigned port; preserve it when applying
the login branding overlay. This configuration correction requires no image
rebuild, schema migration, credential reset or dependency download.

Deployment supplies `HAPPYM_APPLIANCE_CUSTOMER_NAME` and the same-origin PNG
path `HAPPYM_APPLIANCE_CUSTOMER_LOGO_URL`, for example `/brand/customer-logo.png`.
Mount the actual customer asset read-only into
`/app/apps/frontend/public/brand/customer-logo.png`. Customer assets belong to
the customer distribution repository, not the generic engine. No external font
or logo download is needed at login. An unbound appliance does not invent a
customer logo or identity.

The NetForges wordmark is an unchanged copy of the official
`NetForges/Brand/LOGHI/netforges-wordmark-transparent-fixed2.png` asset.
Existing Social Manager wordmarks and icons are retained.

## Independent installation administrator

In appliance mode the installation-local account is created on first bootstrap:

- Login: `superadmin` (or `superadmin@social-manager.local`).
- Initial password: `changeme`.
- Identity: `social-manager.local-superadmin`, provider LOCAL, real SuperAdmin
  with organization memberships; it does not use a HappyM.Pharma session.

The initial password never yields a normal session. Successful authentication
returns a signed five-minute password-change challenge with a dedicated purpose
and no session user ID. The first access must choose a password of 12–256
characters. Completion compares and updates the stored credential atomically;
expired, wrong-purpose, stale or concurrently consumed challenges are rejected.
The challenge is held in page memory, not a URL or browser storage.

Ordinary restarts preserve the chosen password, account state and existing
membership restrictions. Bootstrap creates missing identities/memberships only;
an unrelated owner of the reserved email is a conflict, never an account to
promote. Credentials cannot be transferred through the credential-swap API.
Subsequent password changes cannot restore `changeme`.

`HAPPYM_APPLIANCE_LOCAL_ADMIN_ENABLED=false` explicitly disables this access
and its bootstrap. Normal auth middleware re-resolves the database user and
rejects disabled, reduced or still-uninitialized local-administrator sessions.
The independent account does not replace or rotate service/M2M credentials,
the existing protected installation administrator, or local demo credentials.
Installing this source into an existing appliance is a runtime mutation: the
runtime owner must schedule it after ongoing database work.

## Appliance administration and common presentation: 3.0.1 Source delta

The real installation SuperAdmin receives the original settings component,
including its normal subscription and service-availability gates. Presentation
requires both `isSuperAdmin=true` and the current organization role `SUPERADMIN`
from authenticated `/user/self`, with a current organization. Auth middleware
already re-resolves the database user and enabled organization membership.
An organization administrator or member is not promoted; their existing
CRM-managed appliance settings landing remains. Backend authorization, tenant
selection, API keys, credentials and licensed/hosted-only features are unchanged.
The original sidebar menu is retained; billing-only links still require billing.

The appliance root uses the light palette and white workspace, calendar,
settings and dialogs. Only its navigation sidebar uses the dark palette. The
appliance does not mount the dark-mode toggle, so an old theme cookie cannot
switch the entire workspace back to dark. Header, table and form spacing is
compact. Shared dialogs stay within the viewport; standard dialogs keep their
title outside the scrolling body. Requested dialog maximum widths are capped
to the viewport. These styles are scoped to the appliance root and do not change
the original hosted product or the CRM embedded root. The sidebar is in the
normal layout flow, avoiding the original SuperAdmin-only fixed-width overlap.

The `happym-test-fixture` icon is an unchanged copy of the bundled Social Manager
64px icon under the existing platform-image path. The provider retains its
`[SIMULAZIONE]` name and cannot impersonate a real external social network. The
shared icon path fixes its missing badge in calendar, channel and selector views
without changing delivery, provider permissions or fixture records.

This delta is Source-only. The qualified local 3.0.0 image and its passed login,
restart and synthetic-engine evidence are preserved. Application/build of 3.0.1
waits until Root closes the current CRM editorial workflow and assigns a new
finite window. No new schema, package dependency, download or secret is required.
The graphics editor and CRM ApplicationStyle/KitStyle remain outside this work.

## Verification scope

Focused regression tests cover initial challenge versus session, expiration,
password policy, one-use compare-and-set, concurrent changes, bootstrap
credential persistence, reserved-email conflicts and disabled installation.
The Source CI runs that file before the existing build. Actual first login,
customer-logo rendering and restart persistence require the successor image
and a finite runtime/browser assignment. Existing isolated appliance QA remains
evidence for its previous exact image; it is not relabeled as new UI evidence.
