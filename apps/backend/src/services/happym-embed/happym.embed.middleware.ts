import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import {
  HAPPYM_EMBED_COOKIE,
  HappyMEmbedSessionClaims,
} from './happym.embed.types';

@Injectable()
export class HappyMEmbedMiddleware implements NestMiddleware {
  private isAllowedEndpoint(req: Request, claims: HappyMEmbedSessionClaims) {
    const method = req.method?.toUpperCase();
    const path = (req.originalUrl || req.path || '')
      .split('?')[0]
      .replace(/^\/api(?=\/)/, '')
      .replace(/\/$/, '');

    const commonRoutes = new Set([
      'GET /happym/embed-sessions/current',
      'GET /happym/embed-sessions/user',
    ]);
    if (commonRoutes.has(`${method} ${path}`)) {
      return true;
    }

    if (claims.purpose === 'connect') {
      return (
        (method === 'GET' && /^\/integrations\/social\/[^/]+$/.test(path)) ||
        (method === 'POST' &&
          /^\/integrations\/provider\/[^/]+\/connect$/.test(path))
      );
    }

    if (claims.purpose === 'workspace') {
      if (`${method} ${path}` === 'GET /user/self') {
        return true;
      }

      if (claims.landingPath === '/media') {
        return /^\/media(?:\/|$)/.test(path);
      }

      if (claims.landingPath !== '/launches') {
        return false;
      }

      if (
        /^\/(posts|media|comments|signatures|sets|analytics)(?:\/|$)/.test(
          path
        ) ||
        `${method} ${path}` === 'GET /settings/shortlink'
      ) {
        return true;
      }

      if (
        `${method} ${path}` === 'GET /integrations' ||
        `${method} ${path}` === 'GET /integrations/list' ||
        `${method} ${path}` === 'GET /integrations/customers' ||
        `${method} ${path}` === 'POST /integrations/mentions' ||
        `${method} ${path}` === 'POST /integrations/function'
      ) {
        return true;
      }

      const integrationId = path.match(/^\/integrations\/([^/]+)(?:\/|$)/)?.[1];
      return (
        !!integrationId && claims.allowedIntegrationIds.includes(integrationId)
      );
    }

    const composerRoutes = new Set([
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
      composerRoutes.has(`${method} ${path}`) ||
      `${method} ${path}` === 'GET /user/self' ||
      (method === 'GET' &&
        (/^\/posts\/(?:tags|find-slot(?:\/[^/]+)?)$/.test(path) ||
          /^\/media(?:\/|$)/.test(path) ||
          /^\/third-party(?:\/|$)/.test(path) ||
          /^\/copilot(?:\/(?:credits|list|[^/]+\/list))?$/.test(path))) ||
      (method === 'POST' && /^\/copilot\/(?:chat|agent)$/.test(path)) ||
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

    let claims: HappyMEmbedSessionClaims;
    try {
      claims = verify(token, secret, {
        algorithms: ['HS256'],
      }) as HappyMEmbedSessionClaims;
    } catch {
      throw new ForbiddenException('Invalid or expired HappyM embed session');
    }

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
      throw new ForbiddenException('Invalid or expired HappyM embed session');
    }

    requestWithContext.happyMEmbedContext = claims;
    if (!this.isAllowedEndpoint(req, claims)) {
      throw new ForbiddenException(
        'Endpoint is not available to HappyM embed sessions'
      );
    }
    next();
  }
}
