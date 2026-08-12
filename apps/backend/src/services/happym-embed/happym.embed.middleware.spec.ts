import { ForbiddenException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { HappyMEmbedMiddleware } from './happym.embed.middleware';
import { HAPPYM_EMBED_COOKIE } from './happym.embed.types';

describe('HappyMEmbedMiddleware', () => {
  const middleware = new HappyMEmbedMiddleware();

  beforeEach(() => {
    process.env.HAPPYM_EMBED_SESSION_SECRET = 'session-secret';
  });

  const workspaceRequest = (
    landingPath: '/launches' | '/media',
    path: string
  ) => {
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
        purpose: 'workspace',
        landingPath,
      },
      process.env.HAPPYM_EMBED_SESSION_SECRET!,
      { expiresIn: 60 }
    );
    return {
      method: 'GET',
      originalUrl: `/api${path}`,
      cookies: { [HAPPYM_EMBED_COOKIE]: token },
      user: { id: 'postiz-user-1' },
      org: { id: 'postiz-org-1' },
    } as any;
  };

  const composerRequest = (method: string, path: string) => {
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
        purpose: 'composer',
      },
      process.env.HAPPYM_EMBED_SESSION_SECRET!,
      { expiresIn: 60 }
    );
    return {
      method,
      originalUrl: `/api${path}`,
      cookies: { [HAPPYM_EMBED_COOKIE]: token },
      user: { id: 'postiz-user-1' },
      org: { id: 'postiz-org-1' },
    } as any;
  };

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

  it.each([
    ['GET', '/posts/tags'],
    ['GET', '/media'],
    ['GET', '/media/video-options'],
    ['GET', '/third-party'],
    ['POST', '/copilot/chat'],
    ['GET', '/user/self'],
  ])('allows composer dependency %s %s', (method, path) => {
    const next = jest.fn();
    middleware.use(composerRequest(method, path), {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a denied endpoint from an invalid embed session', () => {
    expect(() =>
      middleware.use(
        composerRequest('POST', '/user/api-key/rotate'),
        {} as any,
        jest.fn()
      )
    ).toThrow('Endpoint is not available to HappyM embed sessions');
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

  it('allows calendar APIs only for a launches workspace', () => {
    const next = jest.fn();
    middleware.use(workspaceRequest('/launches', '/posts'), {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);

    expect(() =>
      middleware.use(workspaceRequest('/media', '/posts'), {} as any, jest.fn())
    ).toThrow(ForbiddenException);
  });

  it('allows media APIs for both editorial workspace surfaces', () => {
    for (const landingPath of ['/launches', '/media'] as const) {
      const next = jest.fn();
      middleware.use(
        workspaceRequest(landingPath, '/media?limit=20'),
        {} as any,
        next
      );
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('allows only pharmacy-scoped integration ids in a launches workspace', () => {
    const next = jest.fn();
    middleware.use(
      workspaceRequest('/launches', '/integrations/integration-1/settings'),
      {} as any,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);

    expect(() =>
      middleware.use(
        workspaceRequest('/launches', '/integrations/integration-2/settings'),
        {} as any,
        jest.fn()
      )
    ).toThrow(ForbiddenException);
  });

  it('denies account administration from a workspace session', () => {
    expect(() =>
      middleware.use(
        workspaceRequest('/launches', '/user/api-key/rotate'),
        {} as any,
        jest.fn()
      )
    ).toThrow(ForbiddenException);
  });
});
