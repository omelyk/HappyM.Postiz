import { ForbiddenException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { HappyMEmbedMiddleware } from './happym.embed.middleware';
import { HAPPYM_EMBED_COOKIE } from './happym.embed.types';

describe('HappyMEmbedMiddleware', () => {
  const middleware = new HappyMEmbedMiddleware();

  beforeEach(() => {
    process.env.HAPPYM_EMBED_SESSION_SECRET = 'session-secret';
  });

  it('leaves normal Postiz sessions unchanged when no embed cookie exists', () => {
    const next = jest.fn();
    middleware.use({ cookies: {} } as any, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attaches a valid embed context only to the matching user and organization', () => {
    const token = sign(
      {
        kind: 'happym-embed',
        postizUserId: 'postiz-user-1',
        postizOrganizationId: 'postiz-org-1',
        tenantId: 'tenant-1',
        pharmacyId: 'pharmacy-1',
        userId: 'happym-user-1',
        allowedIntegrationIds: ['integration-1'],
        origin: 'https://crm.happym.test',
        correlationId: 'correlation-1',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      process.env.HAPPYM_EMBED_SESSION_SECRET!,
      { expiresIn: 60 }
    );
    const request: any = {
      method: 'GET',
      originalUrl: '/api/integrations/list',
      cookies: { [HAPPYM_EMBED_COOKIE]: token },
      user: { id: 'postiz-user-1' },
      org: { id: 'postiz-org-1' },
    };
    const next = jest.fn();

    middleware.use(request, {} as any, next);

    expect(request.happyMEmbedContext.pharmacyId).toBe('pharmacy-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects authenticated APIs outside the embed allow-list', () => {
    const token = sign(
      {
        kind: 'happym-embed',
        postizUserId: 'postiz-user-1',
        postizOrganizationId: 'postiz-org-1',
      },
      process.env.HAPPYM_EMBED_SESSION_SECRET!,
      { expiresIn: 60 }
    );
    const request: any = {
      method: 'GET',
      originalUrl: '/api/user/self',
      cookies: { [HAPPYM_EMBED_COOKIE]: token },
      user: { id: 'postiz-user-1' },
      org: { id: 'postiz-org-1' },
    };

    expect(() => middleware.use(request, {} as any, jest.fn())).toThrow(
      ForbiddenException
    );
  });

  it('rejects a session replayed against another organization', () => {
    const token = sign(
      {
        kind: 'happym-embed',
        postizUserId: 'postiz-user-1',
        postizOrganizationId: 'postiz-org-1',
      },
      process.env.HAPPYM_EMBED_SESSION_SECRET!,
      { expiresIn: 60 }
    );
    const request: any = {
      cookies: { [HAPPYM_EMBED_COOKIE]: token },
      user: { id: 'postiz-user-1' },
      org: { id: 'postiz-org-2' },
    };

    expect(() => middleware.use(request, {} as any, jest.fn())).toThrow(
      ForbiddenException
    );
  });
});
