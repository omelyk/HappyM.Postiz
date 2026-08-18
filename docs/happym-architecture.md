# HappyM.Postiz architecture

HappyM.Postiz is a controlled public fork of Postiz. The upstream monorepo
layout remains unchanged so updates from `gitroomhq/postiz-app` can be merged
with a small, identifiable HappyM delta.

The CRM owns tenants, pharmacies, permissions, the publication registry and
historical analytics. Postiz owns social credentials, provider APIs, the
composer and publishing workflows. Neither service reads the other service's
database.

The first integration slice consists of:

- `/embed/happym/composer`, a fullscreen React iframe route;
- an opaque, single-use ticket exchanged server-to-server with the HappyM
  extension;
- a short-lived Postiz authentication cookie plus a signed HappyM scope cookie;
- server-side filtering and validation of `allowedIntegrationIds`;
- a versioned `postMessage` bridge with an explicit `targetOrigin`.

The initial upstream baseline is Postiz `v2.23.0`, commit
`1e4c8dd5c4f70c4d0abd01e23cc42d5b533d1ab9`, tagged locally and remotely as
`upstream-baseline-v2.23.0`.

## Boundaries of the PoC

An embed session can only call the API routes required to compose, validate and
create a post. The shared Postiz media library, tags, Copilot, administration,
analytics and channel management APIs are denied. Direct media upload remains
available. Pharmacy-scoped media and tags require an explicit ownership model
in a later milestone; they must not be enabled by exposing organization-wide
lists.

The browser cannot select a pharmacy or add integration identifiers outside the
scope signed by the HappyM extension. Historical analytics remain a HappyM
responsibility and will be synchronized through the future SDK/webhook flow.
