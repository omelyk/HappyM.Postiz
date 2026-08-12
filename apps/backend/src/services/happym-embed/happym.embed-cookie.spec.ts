import { UnauthorizedException } from '@nestjs/common';
import {
  HappyMEmbedExchangeController,
  HappyMEmbedSessionController,
} from '@gitroom/backend/api/routes/happym.embed.controller';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';

jest.mock(
  '@gitroom/backend/services/happym-embed/happym.embed.service',
  () => ({ HappyMEmbedService: class HappyMEmbedService {} })
);

describe('Social Manager embed cookies', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('uses host-only cookies for .local, localhost, IP and unknown suffixes', () => {
    expect(
      getCookieUrlFromDomain('https://socialmanager.happym.local')
    ).toBeUndefined();
    expect(getCookieUrlFromDomain('http://localhost:5000')).toBeUndefined();
    expect(getCookieUrlFromDomain('http://127.0.0.1:5000')).toBeUndefined();
    expect(
      getCookieUrlFromDomain('https://socialmanager.happym.internal')
    ).toBeUndefined();
  });

  it('retains a shared registrable domain for public DNS hosts', () => {
    expect(getCookieUrlFromDomain('https://social.example.com')).toBe(
      '.example.com'
    );
  });

  it('omits Domain while retaining Secure and SameSite=None on local HTTPS', async () => {
    process.env.FRONTEND_URL = 'https://socialmanager.happym.local';
    delete process.env.NOT_SECURED;
    const service = {
      exchangeTicket: jest.fn().mockResolvedValue({
        auth: 'auth-token',
        organizationId: 'FARMA1',
        embedSession: 'embed-token',
        ttlSeconds: 300,
        context: {
          purpose: 'composer',
          correlationId: 'correlation-id',
          expiresAt: '2026-08-12T12:00:00.000Z',
        },
      }),
    };
    const response = {
      cookie: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await new HappyMEmbedExchangeController(service as never).exchange(
      { ticket: 'ticket', purpose: 'composer' } as never,
      response as never
    );

    expect(response.cookie).toHaveBeenCalledTimes(3);
    for (const call of response.cookie.mock.calls) {
      expect(call[2]).toMatchObject({
        secure: true,
        sameSite: 'none',
        httpOnly: true,
      });
      expect(call[2]).not.toHaveProperty('domain');
    }
  });

  it('returns a clear 401 instead of dereferencing a missing context', () => {
    expect(() =>
      new HappyMEmbedSessionController().composerUser(undefined, {} as never)
    ).toThrow(UnauthorizedException);

    try {
      new HappyMEmbedSessionController().composerUser(undefined, {} as never);
    } catch (error) {
      expect((error as UnauthorizedException).getStatus()).toBe(401);
      expect((error as UnauthorizedException).getResponse()).toEqual({
        code: 'happym_embed_session_required',
        message: 'A valid Social Manager embed session is required.',
      });
    }
  });
});
