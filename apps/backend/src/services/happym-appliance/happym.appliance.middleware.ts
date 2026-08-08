import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class HappyMApplianceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.HAPPYM_APPLIANCE_MODE !== 'true') {
      res.status(HttpStatus.NOT_FOUND).json({ code: 'appliance_not_enabled' });
      return;
    }

    const expectedClientId = process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID;
    const expectedSecret = process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET;
    if (!expectedClientId || !expectedSecret) {
      res
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json({ code: 'appliance_control_plane_not_configured' });
      return;
    }

    const clientId = req.header('X-HappyM-Client-Id') || '';
    const authorization = req.header('Authorization') || '';
    const secret = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    if (
      !this.fixedEquals(clientId, expectedClientId) ||
      !this.fixedEquals(secret, expectedSecret)
    ) {
      res.status(HttpStatus.UNAUTHORIZED).json({ code: 'invalid_client' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    next();
  }

  private fixedEquals(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }
}
