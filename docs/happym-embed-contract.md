# HappyM iframe contract v1

The parent and child exchange envelopes with `source: "happym-postiz"`,
`version: "1.0"`, a type, correlation ID, timestamp and payload. Both sides must
verify `event.origin`, `event.source`, source and version. No token is sent with
`postMessage`.

Child-to-parent events implemented in the first slice:

- `embed.ready` with tenant, pharmacy and session expiry;
- `post.draftSaved`, `post.created` or `post.scheduled`, one per created Postiz
  post, including `postizPostId`, integration ID and provider;
- `embed.closeRequested`.

Parent-to-child commands implemented:

- `embed.init` and `theme.changed` for light/dark mode;
- `composer.close`;
- `composer.reloadIntegrations`.

The `origin` and tenant/pharmacy identifiers always come from the signed server
session, never from a browser command. Future publication lifecycle events
(`post.published`, `post.failed`) belong to the webhook/SDK milestone.
