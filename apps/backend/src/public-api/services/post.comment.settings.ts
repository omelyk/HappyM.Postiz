export const POST_COMMENTS_CONTRACT_VERSION = 'post-comments/v1';

export class PostCommentSettingsInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostCommentSettingsInvalidError';
  }
}

type CommentInput = string | { content?: unknown; delay?: unknown };

function normalizeComment(
  value: CommentInput,
  key: string,
  allowDelay: boolean
): { content: string; image: never[]; delay?: number } | undefined {
  if (typeof value === 'string') {
    const content = value.trim();
    return content ? { content, image: [] } : undefined;
  }

  if (!value || typeof value !== 'object' || typeof value.content !== 'string') {
    throw new PostCommentSettingsInvalidError(
      `${key} must contain non-empty strings${
        allowDelay ? ' or { content, delay } objects' : ''
      }.`
    );
  }

  const content = value.content.trim();
  if (!content) {
    return undefined;
  }

  if (!allowDelay && value.delay !== undefined) {
    throw new PostCommentSettingsInvalidError(`${key} does not support delay.`);
  }

  if (value.delay === undefined || value.delay === null) {
    return { content, image: [] };
  }

  const delay = Number(value.delay);
  if (!Number.isInteger(delay) || delay < 0) {
    throw new PostCommentSettingsInvalidError(
      `${key}.delay must be a non-negative integer number of minutes.`
    );
  }

  return { content, image: [], delay };
}

export function normalizePublicPostCommentSettings(rawBody: any) {
  if (!rawBody || !Array.isArray(rawBody.posts)) {
    return rawBody;
  }

  return {
    ...rawBody,
    posts: rawBody.posts.map((post: any, postIndex: number) => {
      if (
        !post?.settings ||
        typeof post.settings !== 'object' ||
        Array.isArray(post.settings)
      ) {
        return post;
      }

      const settings = { ...post.settings };
      const hasFirstComment = Object.prototype.hasOwnProperty.call(
        settings,
        'firstComment'
      );
      const hasComments = Object.prototype.hasOwnProperty.call(
        settings,
        'comments'
      );
      if (!hasFirstComment && !hasComments) {
        return post;
      }

      const normalizedComments: Array<{
        content: string;
        image: never[];
        delay?: number;
      }> = [];

      if (hasFirstComment) {
        if (typeof settings.firstComment !== 'string') {
          throw new PostCommentSettingsInvalidError(
            `posts[${postIndex}].settings.firstComment must be a string.`
          );
        }
        const first = normalizeComment(
          settings.firstComment,
          `posts[${postIndex}].settings.firstComment`,
          false
        );
        if (first) normalizedComments.push(first);
        delete settings.firstComment;
      }

      if (hasComments) {
        if (!Array.isArray(settings.comments)) {
          throw new PostCommentSettingsInvalidError(
            `posts[${postIndex}].settings.comments must be an array.`
          );
        }
        settings.comments.forEach((comment: CommentInput, commentIndex: number) => {
          const normalized = normalizeComment(
            comment,
            `posts[${postIndex}].settings.comments[${commentIndex}]`,
            true
          );
          if (normalized) normalizedComments.push(normalized);
        });
        delete settings.comments;
      }

      return {
        ...post,
        settings,
        value: [...(Array.isArray(post.value) ? post.value : []), ...normalizedComments],
      };
    }),
  };
}

export function postCommentSettingsContract(supported: boolean) {
  return {
    contractVersion: POST_COMMENTS_CONTRACT_VERSION,
    supported,
    firstComment: {
      key: 'firstComment',
      type: 'string',
      description: 'First public comment below the published post.',
    },
    comments: {
      key: 'comments',
      type: 'array',
      items: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            required: ['content'],
            properties: {
              content: { type: 'string' },
              delay: {
                type: 'integer',
                minimum: 0,
                unit: 'minutes',
                description: 'Delay after the previous item.',
              },
            },
          },
        ],
      },
      description: 'Additional public comments in publication order.',
    },
    nativeRepresentation: {
      path: 'posts[].value[1..]',
      delayKey: 'delay',
      delayUnit: 'minutes',
    },
  };
}
