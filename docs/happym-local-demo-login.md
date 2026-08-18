# Social Manager local demo login

The login helper is intended only for a controlled local appliance stack. Enable it
explicitly with:

```dotenv
HAPPYM_APPLIANCE_MODE=true
HAPPYM_DEV_LOGIN_HINT=true
HAPPYM_DEV_LOGIN_EMAIL=superadmin
HAPPYM_DEV_LOGIN_PASSWORD=Demo123456
```

`superadmin` is normalized to `superadmin@happym.local` because the login form uses
an email identifier. When the hint is enabled, the appliance bootstrap creates or
updates that separate local user as `SUPERADMIN` in every CRM-provisioned workspace
and aligns its password at startup. The service administrator configured through
`HAPPYM_APPLIANCE_ADMIN_*` remains unchanged and continues to own CRM admin SSO.

The chip only fills the form; it never submits it. The credentials are not logged or
returned by an API. They are sent to the login page only when both appliance mode and
the explicit hint flag are `true`.

Do not set `HAPPYM_DEV_LOGIN_HINT` in staging or production. Without that explicit
flag, bootstrap continues to use `HAPPYM_APPLIANCE_ADMIN_EMAIL` and
`HAPPYM_APPLIANCE_ADMIN_PASSWORD`, whose password must contain at least 12 characters.
