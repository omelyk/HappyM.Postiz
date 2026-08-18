import { ForbiddenException } from '@nestjs/common';
import { HappyMEmbedSessionClaims } from './happym.embed.types';

export const assertHappyMEmbedIntegration = (
  integrationId: string | undefined,
  context?: HappyMEmbedSessionClaims
) => {
  if (
    context &&
    (!integrationId || !context.allowedIntegrationIds.includes(integrationId))
  ) {
    throw new ForbiddenException(
      'Integration is not allowed for this pharmacy'
    );
  }
};

export const assertHappyMEmbedPostIntegrations = (
  posts: Array<{ integration?: { id?: string } }>,
  context?: HappyMEmbedSessionClaims
) => {
  if (!context) {
    return;
  }
  if (posts.length === 0) {
    throw new ForbiddenException(
      'Integration is not allowed for this pharmacy'
    );
  }
  for (const post of posts) {
    assertHappyMEmbedIntegration(post.integration?.id, context);
  }
};
