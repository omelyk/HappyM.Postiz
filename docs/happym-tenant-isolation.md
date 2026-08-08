# Tenant and pharmacy isolation

The HappyM extension is the authority that maps a pharmacy to Postiz social
integrations. HappyM.Postiz verifies that each mapped integration belongs to the
selected Postiz organization before minting a session.

For requests carrying `happym_embed`:

- the signed Postiz user and organization must match the authenticated request;
- `/integrations/list` returns only signed integration IDs;
- provider functions and mention lookup reject an integration outside the
  signed list;
- post validation and creation reject missing or out-of-scope integrations;
- all unrelated authenticated API routes return `403`;
- organization-wide media and tag listings are intentionally unavailable.

This prevents pharmacy A from publishing through an integration assigned only
to pharmacy B even when both use the same Postiz organization. It does not by
itself create pharmacy ownership for native Postiz resources such as tags and
media. Those features remain disabled in the embed until their ownership is
modeled in HappyM or each pharmacy is assigned a separate Postiz organization.

Automated tests cover invalid organization replay, cross-integration access,
origin rejection, consumed tickets and API allow-list enforcement. Full browser
E2E with two real pharmacy fixtures is gated on the extension and SDK test
harness.
