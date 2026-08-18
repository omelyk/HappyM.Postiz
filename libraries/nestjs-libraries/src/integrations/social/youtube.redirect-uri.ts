type YoutubeRedirectEnvironment = Record<string, string | undefined>;

const YOUTUBE_CALLBACK_PATH = '/integrations/social/youtube';

export const youtubeRedirectUri = (
  environment: YoutubeRedirectEnvironment = process.env
) => {
  const override = environment.YOUTUBE_REDIRECT_URI?.trim();
  if (override) {
    const uri = new URL(override);
    if (!['http:', 'https:'].includes(uri.protocol) || uri.username || uri.password) {
      throw new Error('YOUTUBE_REDIRECT_URI must be an HTTP(S) URI');
    }
    return uri.toString();
  }

  return `${environment.FRONTEND_URL}${YOUTUBE_CALLBACK_PATH}`;
};
