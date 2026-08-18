# Social Manager YouTube OAuth redirect

Social Manager supports a YouTube-only callback override through the complete
URI in `YOUTUBE_REDIRECT_URI`. It does not change `FRONTEND_URL`, so Facebook,
Instagram, LinkedIn, TikTok and the other providers keep their configured public
host.

For a typical local UAT appliance exposed on port 4007:

```text
FRONTEND_URL=https://socialmanager.happym.local
YOUTUBE_REDIRECT_URI=http://localhost:4007/integrations/social/youtube
```

The Google Cloud OAuth client must contain the exact same authorized redirect
URI, including scheme, host, port and path. `localhost` and `127.0.0.1` are
different redirect URIs; register and configure the one the appliance actually
uses.

In production leave `YOUTUBE_REDIRECT_URI` unset. The callback then remains:

```text
${FRONTEND_URL}/integrations/social/youtube
```

The effective callback is visible without secrets from:

```text
GET /api/appliance/providers/youtube
GET /api/appliance/providers
```

The override is resolved for both the authorization URL and authorization-code
exchange, preventing Google `redirect_uri_mismatch` errors.
