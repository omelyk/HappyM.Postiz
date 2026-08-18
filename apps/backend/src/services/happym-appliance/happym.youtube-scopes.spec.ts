import { YOUTUBE_OAUTH_SCOPES } from '@gitroom/nestjs-libraries/integrations/social/youtube.scopes';

describe('YouTube OAuth scopes', () => {
  it('requests only the capabilities used by Social Manager', () => {
    expect(YOUTUBE_OAUTH_SCOPES).toEqual([
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ]);
  });

  it('does not request broad channel-management or partner scopes', () => {
    expect(YOUTUBE_OAUTH_SCOPES).not.toContain(
      'https://www.googleapis.com/auth/youtube'
    );
    expect(YOUTUBE_OAUTH_SCOPES).not.toContain(
      'https://www.googleapis.com/auth/youtube.force-ssl'
    );
    expect(YOUTUBE_OAUTH_SCOPES).not.toContain(
      'https://www.googleapis.com/auth/youtubepartner'
    );
  });
});
