# Pre-publish render hook v1

Release `1.0.0-beta.5` implements **Option A: claim lease + attach rendered + Temporal gate**. Social Manager remains the source of truth for social occurrences and delivery; the consumer only renders and uploads final artifacts.

## Release classification

**PrePublish-Render-Hook: Warning**

- Contract version: `prepublish-render/v1`
- Breaking: no
- Gate enforce: yes (publishing is blocked without a successful attach for the current occurrence)
- Warning: v1 supports exactly one target per occurrence. Schedule one Social Manager post per integration/target. Live joint Docker/Temporal/CRM UAT is still required before production enablement.
- Test evidence: `prepublish-render.service.spec.ts` (lease conflict/expiry, killed consumer, persisted-state restart, attach idempotency, publish gate, tenant isolation, recurrence N=3); `PostizClientTests` render tests (typed routes, organization scope, idempotency header, cross-runtime canonical hash, structured reason code); backend and orchestrator production builds; complete .NET test suites.

## Contract

An opt-in scheduled target contains:

```json
{
  "integration": { "id": "sm-integration-id" },
  "value": [{ "content": "", "image": [] }],
  "settings": { "...": "provider settings" },
  "prePublishRender": {
    "leadTimeSeconds": 600,
    "correlation": {
      "crmSocialPostId": "crm-guid",
      "snapshotId": "snapshot-guid",
      "pharmacyGroupId": "group-guid",
      "pharmacyId": "pharmacy-guid"
    }
  }
}
```

`POST /public/v1/posts` returns `occurrenceId` alongside `postId` for render-required targets. Non-render posts retain the existing V106 flow unchanged.

State flow:

`Scheduled → AwaitingRender → ReadyToPublish → Publishing → Published | Failed`

Terminal alternatives are `RenderTimedOut` and `Cancelled`. At `publishDate`, or when an acquired lease expires without attach, the occurrence becomes `RenderTimedOut`; it is never published.

Defaults and bounds:

- lead time: 600 seconds; per target 60–3600; appliance default override `HAPPYM_RENDER_LEAD_TIME_SECONDS`;
- lease: 300 seconds; request bound 60–900 and never beyond `scheduledFor`;
- render token: opaque HMAC token; only its SHA-256 digest is persisted; configure `HAPPYM_RENDER_TOKEN_SECRET` (minimum 32 characters), otherwise the internal appliance client secret is used;
- API authentication and `X-HappyM-Organization-Id` follow the existing public M2M API. Every lookup and mutation is organization-scoped.

## API

List/get/cancel:

```http
GET  /public/v1/prepublish-render/occurrences?status=AwaitingRender&take=50
GET  /public/v1/prepublish-render/occurrences/{occurrenceId}
POST /public/v1/prepublish-render/occurrences/{occurrenceId}/cancel
```

Claim:

```bash
curl -X POST "$SM/public/v1/prepublish-render/occurrences/$OCC/claim-render" \
  -H "Authorization: $SM_API_KEY" \
  -H "X-HappyM-Organization-Id: $ORG" \
  -H "Idempotency-Key: claim-$OCC-attempt-1" \
  -H "Content-Type: application/json" \
  -d '{"workerId":"pharma-render-worker-1","leaseSeconds":300}'
```

The response contains `renderToken` and `leaseExpiresAt`. Replaying the same worker/idempotency key during the active lease returns the same token. Another worker receives `RenderLeaseHeld`.

Attach final tenant-owned media:

```bash
curl -X POST "$SM/public/v1/prepublish-render/occurrences/$OCC/attach-rendered" \
  -H "Authorization: $SM_API_KEY" \
  -H "X-HappyM-Organization-Id: $ORG" \
  -H "Idempotency-Key: attach-$OCC-v1" \
  -H "Content-Type: application/json" \
  -d '{
    "renderToken":"opaque-claim-token",
    "correlation":{"crmSocialPostId":"crm-guid","snapshotId":"snapshot-guid","pharmacyGroupId":"group-guid","pharmacyId":"pharmacy-guid"},
    "targets":[{"integrationId":"sm-integration-id","channel":"youtube","caption":"Resolved caption","media":[{"mediaId":"sm-media-id","kind":"video","mime":"video/mp4"}],"extras":{"youtubeTitle":"Resolved title","thumbnailMediaId":"sm-thumbnail-id"}}],
    "renderedAtUtc":"2026-08-26T08:00:00Z",
    "contentHash":"sha256-..."
  }'
```

The hash is SHA-256 over canonical JSON containing exactly `occurrenceId`, `correlation`, `targets`, and the submitted `renderedAtUtc`. Object keys are ordinal-sorted; arrays retain order. Use `AttachRenderedRequest.Create(...)` in `Postiz.NET` or the `IPostizGateway.AttachRenderedAsync(...)` adapter, which calculate it correctly.

The server rejects missing/cross-tenant media, `.hmproj`, unresolved `{{ds_*}}`/`{{env_*}}`, correlation or integration mismatch, invalid token, expired lease, and hash mismatch. Secrets and render tokens are never returned in errors or logs.

## Reason codes

| ReasonCode | HTTP / handling |
|---|---|
| `RenderRequired` | 409; occurrence is not claimable in its current phase |
| `RenderLeaseHeld` | 409; wait for the active lease outcome |
| `RenderTimedOut` | 410; do not publish; reschedule/operator action |
| `RenderPayloadInvalid` | 400/403/422; fix token, correlation, hash or media |
| `PublishBlockedNoRender` | 409; invariant guard blocked delivery |
| `OccurrenceCancelled` | 409; terminal informational state |
| `OccurrenceNotFound` | 404; also used for cross-tenant access |
| `TransientEngine` | 503; retry according to SDK `IsTransient` |

## SDK surface

`IPostizClient.PrePublishRender` exposes `ListAsync`, `GetAsync`, `ClaimAsync`, `AttachRenderedAsync`, and `CancelAsync`. `CreatedPost.OccurrenceId` and `PostizPostTarget.PrePublishRender` complete the schedule-to-render correlation. `HappyM.Pharma.Postiz.Application.IPostizGateway` exposes the same render-only operations without leaking transport details.

Pharma integration must remain feature-flagged for this Warning release until the joint static, recurring, consumer-kill and Temporal-restart UAT is green.
