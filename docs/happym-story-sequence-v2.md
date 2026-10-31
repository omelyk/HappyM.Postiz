# Story sequence contract (`prepublish-render/v2`)

Release `1.0.0-beta.8` adds an optional Story-sequence mode to the existing
claim/attach render gate. The HTTP routes remain under `/public/v1`; capability
discovery advertises both `prepublish-render/v1` and `prepublish-render/v2`.

## Attach

Use one Social Manager occurrence per integration. Set `publishMode` only for a
multi-slide Story; the order of `media` is the authoritative slide order.

```json
{
  "renderToken": "opaque-claim-token",
  "correlation": {
    "crmSocialPostId": "crm-guid",
    "snapshotId": "snapshot-guid",
    "pharmacyGroupId": "group-guid",
    "pharmacyId": "pharmacy-guid"
  },
  "targets": [{
    "integrationId": "sm-integration-id",
    "channel": "instagram",
    "caption": "Resolved Story caption",
    "publishMode": "story_sequence",
    "media": [
      { "mediaId": "slide-0-media-id", "kind": "image", "mime": "image/png" },
      { "mediaId": "slide-1-media-id", "kind": "video", "mime": "video/mp4" }
    ]
  }],
  "renderedAtUtc": "2026-09-02T08:00:00Z",
  "contentHash": "sha256-..."
}
```

Rules:

- exactly one target per occurrence, as in v1;
- `publishMode=story_sequence` requires `post_type=story` and 2–10 media;
- supported providers are `facebook`, `instagram` and
  `instagram-standalone`;
- video slides must be MP4 (`kind=video`, `mime=video/mp4`, `.mp4` media path);
- image slides must use PNG or JPEG and may use an empty Story caption;
- image/video mixing is supported; image PNG is normalized to JPEG for
  Instagram delivery;
- LinkedIn Stories and WhatsApp Status are rejected with
  `story_sequence_unsupported` because this appliance has no corresponding
  delivery provider;
- omit `publishMode` for v1, carousel and single-media Story behavior.

The content hash includes `publishMode` and the ordered media array. Replaying
the same attach idempotency key and content hash returns the same occurrence.

## Receipt

Attach returns `ReadyToPublish`; provider receipts appear after delivery in
`GET /public/v1/prepublish-render/occurrences/{occurrenceId}` and list results:

```json
{
  "status": "Published",
  "releaseId": "last-provider-story-id",
  "releaseUrl": "https://provider.example/story/last",
  "publishReceipt": {
    "bundleId": "story-sequence:occurrence-id",
    "mode": "story_sequence",
    "provider": "instagram",
    "status": "Published",
    "children": [
      {
        "slideIndex": 0,
        "mediaId": "slide-0-media-id",
        "providerId": "provider-story-0",
        "releaseUrl": "https://provider.example/story/0",
        "providerContainerId": "optional-container-0",
        "recovered": false
      }
    ]
  }
}
```

`bundleId` is a deterministic Social Manager audit ID. Facebook and Instagram
publish ordered individual Story objects; neither provider offers an atomic
multi-slide Story ID. `children` is therefore the authoritative audit receipt,
while the legacy `releaseId`/`releaseUrl` continue to identify the last slide.

## Release classification

**Story-Sequence: Warning**

- Contract version: `prepublish-render/v2`
- Breaking: no
- Gate enforce: yes
- Known limits: live Facebook/Instagram UAT is required; provider processing
  validates video duration because the Social Manager Media model has no
  trusted duration field.
