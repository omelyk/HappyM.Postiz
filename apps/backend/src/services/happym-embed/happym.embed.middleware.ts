import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import {
  HAPPYM_EMBED_COOKIE,
  HappyMEmbedSessionClaims,
} from './happym.embed.types';

@Injectable()
export class HappyMEmbedMiddleware implements NestMiddleware {
  private isAllowedEndpoint(req: Request) {
    const method = req.method?.toUpperCase();
    const path = (req.originalUrl || req.path || '')
      .split('?')[0]
      .replace(/^\/api(?=\/)/, '')
      .replace(/\/$/, '');

    const exactRoutes = new Set([
      'GET /happym/embed-sessions/current',
      'GET /happym/embed-sessions/user',
      'GET /integrations/list',
      'POST /integrations/mentions',
      'POST /integrations/function',
      'GET /posts/find-slot',
      'POST /posts/should-shortlink',
      'POST /posts/valid',
      'POST /posts',
      'GET /settings/shortlink',
      'POST /media/upload-server',
      'POST /media/save-media',
      'POST /media/upload-simple',
      'POST /media/create-multipart-upload',
      'POST /media/list-parts',
      'POST /media/sign-part',
      'POST /media/abort-multipart-upload',
      'POST /media/complete-multipart-upload',
    ]);

    return (
      exactRoutes.has(`${method} ${path}`) ||
      (method === 'GET' && /^\/integrations\/[^/]+\/internal-plugs$/.test(path))
    );
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const token = req.cookies?.[HAPPYM_EMBED_COOKIE];
    if (!token) {
      next();
      return;
    }

    const secret = process.env.HAPPYM_EMBED_SESSION_SECRET;
    if (!secret) {
      throw new ForbiddenException('HappyM embed sessions are not configured');
    }

    try {
      const claims = verify(token, secret, {
        algorithms: ['HS256'],
      }) as HappyMEmbedSessionClaims;
      const requestWithContext = req as Request & {
        user?: { id?: string };
        org?: { id?: string };
        happyMEmbedContext?: HappyMEmbedSessionClaims;
      };

      if (
        claims.kind !== 'happym-embed' ||
        claims.postizUserId !== requestWithContext.user?.id ||
        claims.postizOrganizationId !== requestWithContext.org?.id
      ) {
        throw new Error('Embed session does not match the authenticated user');
      }

      requestWithContext.happyMEmbedContext = claims;
      if (!this.isAllowedEndpoint(req)) {
        throw new Error('Endpoint is not available to HappyM embed sessions');
      }
      next();
    } catch {
      throw new ForbiddenException('Invalid or expired HappyM embed session');
    }
  }
}
