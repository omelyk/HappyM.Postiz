import { HttpException } from '@nestjs/common';
import { HappyMEmbedSessionClaims } from './happym.embed.types';
import { assertHappyMEmbedPostIntegrations } from './happym.embed.authorization';

describe('HappyM embed tenant isolation', () => {
  const pharmacyA: HappyMEmbedSessionClaims = {
    kind: 'happym-embed',
    postizUserId: 'postiz-user-1',
    postizOrganizationId: 'postiz-org-1',
    tenantId: 'tenant-1',
    pharmacyId: 'pharmacy-a',
    userId: 'happym-user-1',
    allowedIntegrationIds: ['integration-a'],
    origin: 'https://crm.happym.test',
    correlationId: 'correlation-a',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    purpose: 'composer',
  };

  it('rejects pharmacy A attempting to use an integration for pharmacy B', () => {
    expect(() =>
      assertHappyMEmbedPostIntegrations(
        [{ integration: { id: 'integration-b' } }],
        pharmacyA
      )
    ).toThrow(HttpException);
  });

  it('allows pharmacy A to use only its assigned integration', () => {
    expect(() =>
      assertHappyMEmbedPostIntegrations(
        [{ integration: { id: 'integration-a' } }],
        pharmacyA
      )
    ).not.toThrow();
  });
});
