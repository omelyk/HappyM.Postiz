import { UnauthorizedException } from '@nestjs/common';

export const isHappyMEmbedUserRequestUrl = (url: string) =>
  url
    .split('?')[0]
    .replace(/^\/api(?=\/)/, '')
    .replace(/\/$/, '') === '/happym/embed-sessions/user';

export const happyMEmbedSessionRequired = () =>
  new UnauthorizedException({
    code: 'happym_embed_session_required',
    message: 'A valid Social Manager embed session is required.',
  });
