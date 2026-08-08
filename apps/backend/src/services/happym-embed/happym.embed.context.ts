import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { HappyMEmbedSessionClaims } from './happym.embed.types';

export const GetHappyMEmbedContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.happyMEmbedContext as HappyMEmbedSessionClaims | undefined;
  }
);
