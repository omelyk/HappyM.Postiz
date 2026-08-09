type Environment = Record<string, string | undefined>;

const requiredVariables: Record<string, string[][]> = {
  discord: [['DISCORD_CLIENT_ID'], ['DISCORD_CLIENT_SECRET']],
  dribbble: [['DRIBBBLE_CLIENT_ID'], ['DRIBBBLE_CLIENT_SECRET']],
  facebook: [['FACEBOOK_APP_ID'], ['FACEBOOK_APP_SECRET']],
  farcaster: [['NEYNAR_CLIENT_ID'], ['NEYNAR_SECRET_KEY']],
  instagram: [['FACEBOOK_APP_ID'], ['FACEBOOK_APP_SECRET']],
  'instagram-standalone': [['INSTAGRAM_APP_ID'], ['INSTAGRAM_APP_SECRET']],
  kick: [['KICK_CLIENT_ID'], ['KICK_SECRET']],
  linkedin: [['LINKEDIN_CLIENT_ID'], ['LINKEDIN_CLIENT_SECRET']],
  'linkedin-page': [['LINKEDIN_CLIENT_ID'], ['LINKEDIN_CLIENT_SECRET']],
  mastodon: [['MASTODON_CLIENT_ID'], ['MASTODON_CLIENT_SECRET']],
  mewe: [['MEWE_APP_ID'], ['MEWE_API_KEY']],
  pinterest: [['PINTEREST_CLIENT_ID'], ['PINTEREST_CLIENT_SECRET']],
  reddit: [['REDDIT_CLIENT_ID'], ['REDDIT_CLIENT_SECRET']],
  slack: [['SLACK_ID'], ['SLACK_SECRET']],
  telegram: [['TELEGRAM_TOKEN']],
  threads: [['THREADS_APP_ID'], ['THREADS_APP_SECRET']],
  tiktok: [['TIKTOK_CLIENT_ID'], ['TIKTOK_CLIENT_SECRET']],
  tumblr: [['TUMBLR_CLIENT_ID'], ['TUMBLR_CLIENT_SECRET']],
  twitch: [['TWITCH_CLIENT_ID'], ['TWITCH_CLIENT_SECRET']],
  vk: [['VK_ID']],
  whop: [['WHOP_CLIENT_ID']],
  x: [['X_API_KEY'], ['X_API_SECRET']],
  youtube: [['YOUTUBE_CLIENT_ID'], ['YOUTUBE_CLIENT_SECRET']],
};

export const isHappyMConnectProviderConfigured = (
  provider: string,
  environment: Environment = process.env
) => {
  if (provider === 'gmb') {
    return (
      (!!environment.GOOGLE_GMB_CLIENT_ID &&
        !!environment.GOOGLE_GMB_CLIENT_SECRET) ||
      (!!environment.YOUTUBE_CLIENT_ID && !!environment.YOUTUBE_CLIENT_SECRET)
    );
  }

  const requirements = requiredVariables[provider];
  return (
    !requirements ||
    requirements.every((alternatives) =>
      alternatives.some((name) => !!environment[name])
    )
  );
};
