import {
  normalizePublicPostCommentSettings,
  postCommentSettingsContract,
  PostCommentSettingsInvalidError,
} from './post.comment.settings';
import { FacebookProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import { InstagramProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.provider';

describe('public post comment settings', () => {
  it('normalizes firstComment and comments into native post values', () => {
    const body = normalizePublicPostCommentSettings({
      type: 'now',
      posts: [
        {
          integration: { id: 'facebook-1' },
          value: [{ content: 'Main post', image: [] }],
          settings: {
            __type: 'facebook',
            firstComment: ' https://example.test ',
            comments: ['Second', { content: ' Third ', delay: 5 }],
            validUntil: '2026-09-01T10:00:00Z',
          },
        },
      ],
    });

    expect(body.posts[0].value).toEqual([
      { content: 'Main post', image: [] },
      { content: 'https://example.test', image: [] },
      { content: 'Second', image: [] },
      { content: 'Third', image: [], delay: 5 },
    ]);
    expect(body.posts[0].settings).toEqual({
      __type: 'facebook',
      validUntil: '2026-09-01T10:00:00Z',
    });
  });

  it('does not change targets without the public comment keys', () => {
    const post = {
      value: [{ content: 'Main', image: [] as never[] }],
      settings: { __type: 'instagram', post_type: 'post' },
    };

    const body = normalizePublicPostCommentSettings({ posts: [post] });

    expect(body.posts[0]).toBe(post);
  });

  it('rejects an invalid comments shape instead of silently dropping it', () => {
    expect(() =>
      normalizePublicPostCommentSettings({
        posts: [{ value: [], settings: { comments: 'not-an-array' } }],
      })
    ).toThrow(PostCommentSettingsInvalidError);
  });

  it('documents the exact keys, types, delay unit and provider support', () => {
    expect(postCommentSettingsContract(true)).toMatchObject({
      contractVersion: 'post-comments/v1',
      supported: true,
      firstComment: { key: 'firstComment', type: 'string' },
      comments: { key: 'comments', type: 'array' },
      nativeRepresentation: { delayKey: 'delay', delayUnit: 'minutes' },
    });
  });

  it('is backed by native public-comment methods for Facebook and Instagram', () => {
    expect(typeof FacebookProvider.prototype.comment).toBe('function');
    expect(typeof InstagramProvider.prototype.comment).toBe('function');
  });
});
