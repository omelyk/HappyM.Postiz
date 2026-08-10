# Social Manager appliance settings smoke test

Run this check against a deployed appliance with an authenticated system
administrator session. Never paste the real cookie into logs or committed
files.

```powershell
$baseUrl = $env:SOCIAL_MANAGER_PUBLIC_URL
$authCookie = '<temporary-auth-cookie>'
$response = Invoke-WebRequest `
  -Uri "$baseUrl/settings" `
  -Headers @{ RSC = '1'; Cookie = "auth=$authCookie" } `
  -SkipCertificateCheck:$false

if ($response.StatusCode -ne 200) { throw 'Settings did not return HTTP 200' }
if ($response.Content.Length -lt 1000) { throw 'Settings RSC payload is unexpectedly small' }
if ($response.Content -notmatch 'Console amministrativa pronta') {
  throw 'Social Manager appliance settings content is missing'
}
```

Browser smoke:

1. enter through the administrator SSO bridge;
2. verify that `/` redirects to `/settings`;
3. verify sidebar, `Social Manager`, configuration status and quick actions;
4. navigate to Media, Analytics and Integrations;
5. open `/launches` in an admin window with an opener but without `msg` or
   `added`: it must remain open;
6. complete an OAuth callback with `msg` or `added`: the popup may close.

The appliance UI must not show upstream product names or environment-variable
names.
