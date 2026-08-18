import {
  happyMEmbedSessionRequired,
  isHappyMEmbedUserRequestUrl,
} from './happym.embed.errors';

describe('HappyM embed session required response', () => {
  it('returns the structured embed error when /user has no auth cookie', async () => {
    expect(
      isHappyMEmbedUserRequestUrl('/api/happym/embed-sessions/user')
    ).toBe(true);
    expect(happyMEmbedSessionRequired()).toMatchObject({
      response: {
        code: 'happym_embed_session_required',
        message: 'A valid Social Manager embed session is required.',
      },
      status: 401,
    });
  });
});
