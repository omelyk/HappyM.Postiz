# Social Manager local cookie policy

Social Manager uses host-only cookies when `FRONTEND_URL` resolves to a special-use
or otherwise non-registrable host such as `socialmanager.happym.local`, `localhost`
or an IP address. A host-only cookie has no `Domain` attribute, so browsers do not
reject it under `.local` public-suffix rules.

HTTPS appliance cookies remain `Secure`, `HttpOnly` and `SameSite=None`, allowing the
CRM to embed Composer, Connect and workspace pages cross-site. Public registrable
domains continue to use their shared eTLD+1 cookie domain.

The reverse-proxy `proxy_cookie_domain .happym.local $host` workaround is not required
starting with appliance image `1.0.0-alpha.18` and may be removed after the rollout.
