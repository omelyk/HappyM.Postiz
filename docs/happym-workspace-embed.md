# Social Manager workspace embed

Release `1.0.0-alpha.13` adds editorial workspace sessions alongside the
existing composer and Connect purposes. The CRM creates the same opaque,
single-use, pharmacy-scoped ticket and specifies one allow-listed landing:

```json
{
  "origin": "https://pharma.example",
  "landingPath": "/launches"
}
```

Supported values are `/launches` (Calendar) and `/media` (Media). The package
returns `/embed/happym/workspace?ticket=...`; Social Manager exchanges it
server-to-server, sets the technical pharmacy session and navigates directly to
the authoritative landing path. The browser cannot override the path.

Workspace claims keep the tenant, pharmacy, Postiz organization/user and
integration allow-list used by the composer. API access is restricted by
purpose and surface: Media cannot call Calendar APIs, Calendar integration-id
routes must target an allowed integration, and neither surface can access
account administration or Connect OAuth endpoints.

Ordinary iframe navigation never calls `window.close()`. The existing Calendar
popup close behavior remains limited to OAuth result callbacks carrying a
`msg` or `added` query value.
