# YouTube OAuth scopes

Social Manager requests only the YouTube capabilities used by its publishing workflow:

- Google profile and email, to identify the connected account;
- `youtube.readonly`, to read the connected channel;
- `youtube.upload`, to upload videos;
- `yt-analytics.readonly`, to read channel analytics.

Authorization requests must not include the broad `youtube`, `youtube.force-ssl` or
`youtubepartner` scopes.

After upgrading from an earlier appliance image, reconnect the YouTube integration
if Google requires the user to grant the revised consent set. The callback URI must
still match the configured `YOUTUBE_REDIRECT_URI` exactly.
