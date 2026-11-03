# Current HappyM scheduling contract

`editorial.schedule-intent/v1` is the current HappyM editorial scheduling write
contract. Its authenticated organization scope comes from the existing public API
middleware. CRM creates one frozen intent per target; the appliance stores the exact
payload and hash and returns an immutable, scoped acceptance receipt. Ordinary Postiz
post APIs still serve the product dashboard, but HappyM scheduling does not fall back
to them.

## Request and receipt

The routes are `POST /public/v1/prepublish-render/schedule-intents/:intentId`,
`GET` at that same path, and `POST` at `:intentId/cancel`. The request has
`payloadJson` and `payloadHash`; the hash is SHA-256 of the exact UTF-8 string,
prefixed with `sha256-`. The envelope carries contract, commandId, crmOccurrenceId,
revisionId, bindingKey and one scheduled post target with complete render correlation.
IDs in the route are opaque ASCII tokens. Payloads are bounded at 256 KiB. The final
normalized post tree is also bounded to 1–100 values, including appended comments.

The receipt has eleven fields: contract, intentId, payloadHash, commandId,
crmOccurrenceId, revisionId, bindingKey, organizationId, state, dispatchState and
links. Every link identifies its integration, post and render occurrence. A matching
repeat returns the retained receipt; a changed payload under the same organization
and intent is a conflict. A receipt confirms schedule acceptance, not social delivery.

## Atomic preparation and reconciliation

A serializable database transaction creates the post tree, render occurrence and
intent with pending dispatch together. Temporal is called after this commit. A
worker acquires a database-time lease and fence, ensures the stable workflow ID with
`USE_EXISTING` and `REJECT_DUPLICATE`, and acknowledges only its current unexpired
lease, checked atomically against PostgreSQL `clock_timestamp()` in the update. It never terminates an existing workflow. A lost Temporal response leaves
pending work for reconciliation. Intent-owned posts are excluded from generic
missing-post recovery that replaces workflows.

Cancellation either records a tombstone before creation or cancels an occurrence
still in a safe render state. Publishing, published, failed and timed-out outcomes
are not guessed safe. Cancellation invalidates the dispatch fence. A request already
admitted to Temporal can overlap cancellation; the durable render cancellation gate
remains necessary. This is not a claim that no RPC can be in flight after cancellation.

## Activation and remaining qualification

`HAPPYM_SCHEDULE_INTENTS_ENABLED` defaults off and must be set only after the release
owner qualifies the new current schema, matching CRM/SDK/Extension build and target
binding. The SQL in `docs/migrations/20261017-editorial-schedule-intents.sql` is a
Source candidate, not an applied migration. There is no old-schema branch or automatic
fallback. Source cases with mocked collaborators do not qualify PostgreSQL isolation,
Temporal, provider delivery, storage, sessions or failover.

Each customer has a separate HappyM deployment, database and logical Postiz per
environment. HappyM replicas A1/A2 of customer A share its database and logical Postiz;
customer B has its own. Pharmacies PA/PB belong to A and are not separate customers.
Postiz high availability requires its own qualification and is not proven by two
HappyM processes or these Source cases.
