# Social Manager 3.0 login

The appliance login is white with the NetForges wordmark, Social Manager logo,
customer identity and copyright footer. Original licenses and upstream notices
remain in the source distribution. The login links to that source and license.
The public `/brand/` asset directory must be accessible before authentication.

The header uses **3.0.0 :.: 2.23.0**. The first is the commercial appliance
version, distinct from API/SDK contract versions. The second is the documented
upstream baseline tag `upstream-baseline-v2.23.0`, peeled commit
`1e4c8dd5c4f70c4d0abd01e23cc42d5b533d1ab9`. The inherited `version.txt`
is not the fork's release metadata. This source version does not attest that a
successor container, customer deployment or production release has been qualified.

## Customer branding

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

## Verification scope

Focused regression tests cover initial challenge versus session, expiration,
password policy, one-use compare-and-set, concurrent changes, bootstrap
credential persistence, reserved-email conflicts and disabled installation.
The Source CI runs that file before the existing build. Actual first login,
customer-logo rendering and restart persistence require the successor image
and a finite runtime/browser assignment. Existing isolated appliance QA remains
evidence for its previous exact image; it is not relabeled as new UI evidence.
