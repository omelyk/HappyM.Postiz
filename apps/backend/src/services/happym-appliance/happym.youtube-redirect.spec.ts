import { youtubeRedirectUri } from '@gitroom/nestjs-libraries/integrations/social/youtube.redirect-uri';
import { HappyMProviderConfigurationService } from './happym.provider-configuration.service';

describe('YouTube OAuth redirect', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    process.env.FRONTEND_URL = 'https://socialmanager.happym.local';
    delete process.env.YOUTUBE_REDIRECT_URI;
  });

  afterAll(() => {
    process.env = original;
  });

  it('uses the YouTube-only full URI override', () => {
    process.env.YOUTUBE_REDIRECT_URI =
      'http://localhost:4007/integrations/social/youtube';

    expect(youtubeRedirectUri()).toBe(
      'http://localhost:4007/integrations/social/youtube'
    );
  });

  it('falls back to FRONTEND_URL without affecting other providers', () => {
    expect(youtubeRedirectUri()).toBe(
      'https://socialmanager.happym.local/integrations/social/youtube'
    );
  });

  it('exposes the effective redirect without exposing the client secret', () => {
    process.env.YOUTUBE_CLIENT_ID = 'youtube-client';
    process.env.YOUTUBE_CLIENT_SECRET = 'youtube-secret';
    process.env.YOUTUBE_REDIRECT_URI =
      'http://127.0.0.1:4007/integrations/social/youtube';

    const status = new HappyMProviderConfigurationService().getYoutubeStatus();

    expect(status).toEqual({
      provider: 'youtube',
      configured: true,
      redirectUri: 'http://127.0.0.1:4007/integrations/social/youtube',
    });
    expect(JSON.stringify(status)).not.toContain('youtube-secret');
  });

  it('rejects non-HTTP redirect schemes', () => {
    process.env.YOUTUBE_REDIRECT_URI = 'javascript:alert(1)';

    expect(() => youtubeRedirectUri()).toThrow(
      'YOUTUBE_REDIRECT_URI must be an HTTP(S) URI'
    );
  });
});
