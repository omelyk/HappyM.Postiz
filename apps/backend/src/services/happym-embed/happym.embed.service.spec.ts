import { ForbiddenException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { HappyMEmbedService } from './happym.embed.service';
import { HappyMEmbedSessionClaims } from './happym.embed.types';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({ IntegrationService: class IntegrationService {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({ OrganizationService: class OrganizationService {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/users/users.service',
  () => ({ UsersService: class UsersService {} })
);

describe('HappyMEmbedService', () => {
  const usersService = {
    getUserById: jest.fn(),
  };
  const organizationService = {
    getOrgsByUserId: jest.fn(),
  };
  const integrationService = {
    getIntegrationsList: jest.fn(),
  };
  const service = new HappyMEmbedService(
    usersService as any,
    organizationService as any,
    integrationService as any
  );

  const context = {
    postizUserId: 'postiz-user-1',
    postizOrganizationId: 'postiz-org-1',
    tenantId: 'tenant-1',
    pharmacyId: 'pharmacy-1',
    userId: 'happym-user-1',
    allowedIntegrationIds: ['integration-1'],
    origin: 'https://crm.happym.test',
    correlationId: 'correlation-1',
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.HAPPYM_EMBED_EXCHANGE_URL =
      'https://crm.happym.test/internal/happym/embed-sessions/exchange';
    process.env.HAPPYM_EMBED_CLIENT_ID = 'postiz';
    process.env.HAPPYM_EMBED_CLIENT_SECRET = 'client-secret';
    process.env.HAPPYM_EMBED_SESSION_SECRET = 'session-secret';
    process.env.HAPPYM_EMBED_ALLOWED_ORIGINS = 'https://crm.happym.test';
    process.env.JWT_SECRET = 'jwt-secret';
    usersService.getUserById.mockResolvedValue({
      id: context.postizUserId,
      activated: true,
      password: 'redacted',
    });
    organizationService.getOrgsByUserId.mockResolvedValue([
      {
        id: context.postizOrganizationId,
        users: [{ disabled: false }],
      },
    ]);
    integrationService.getIntegrationsList.mockResolvedValue([
      { id: 'integration-1' },
    ]);
  });

  it('mints a scoped session only after server-side validation', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(context), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await service.exchangeTicket('opaque-ticket-value');
    const claims = verify(
      result.embedSession,
      process.env.HAPPYM_EMBED_SESSION_SECRET!
    ) as HappyMEmbedSessionClaims;

    expect(claims.kind).toBe('happym-embed');
    expect(claims.pharmacyId).toBe(context.pharmacyId);
    expect(claims.allowedIntegrationIds).toEqual(['integration-1']);
    expect(result.auth).not.toContain('redacted');
    expect(global.fetch).toHaveBeenCalledWith(
      process.env.HAPPYM_EMBED_EXCHANGE_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer client-secret',
          'X-HappyM-Client-Id': 'postiz',
        }),
      })
    );
  });

  it('rejects an integration that does not belong to the Postiz organization', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...context,
          allowedIntegrationIds: ['integration-from-another-pharmacy'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(
      service.exchangeTicket('opaque-ticket-value')
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an origin outside the configured allow-list', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ...context, origin: 'https://attacker.test' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await expect(
      service.exchangeTicket('opaque-ticket-value')
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('preserves the consumed-ticket status returned by HappyM', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'consumed' }), { status: 409 })
      );

    await expect(
      service.exchangeTicket('opaque-ticket-value')
    ).rejects.toMatchObject({ status: 409 });
  });
});
