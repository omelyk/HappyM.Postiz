import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { setSentryUserContext } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';

@Injectable()
export class PublicAuthMiddleware implements NestMiddleware {
  constructor(
    private _organizationService: OrganizationService,
    private _oauthService: OAuthService
  ) {}
  async use(req: Request, res: Response, next: NextFunction) {
    const auth = (req.headers.authorization ||
      req.headers.Authorization) as string;
    if (!auth) {
      res.status(HttpStatus.UNAUTHORIZED).json({ msg: 'No API Key found' });
      return;
    }
    try {
      if (auth.startsWith('pos_')) {
        const authorization = await this._oauthService.getOrgByOAuthToken(auth);
        if (!authorization) {
          res
            .status(HttpStatus.UNAUTHORIZED)
            .json({ msg: 'Invalid OAuth token' });
          return;
        }

        const org = authorization.organization;
        if (!!process.env.STRIPE_SECRET_KEY && !org.subscription) {
          res
            .status(HttpStatus.UNAUTHORIZED)
            .json({ msg: 'No subscription found' });
          return;
        }

        // @ts-ignore
        req.org = { ...org, users: [{ users: { role: 'SUPERADMIN' } }] };
      } else {
        const credentialOrg = await this._organizationService.getOrgByApiKey(
          auth
        );
        if (!credentialOrg) {
          res.status(HttpStatus.UNAUTHORIZED).json({ msg: 'Invalid API key' });
          return;
        }

        const requestedOrgId = req.header('X-HappyM-Organization-Id');
        let org = credentialOrg;
        if (requestedOrgId) {
          const systemOrgId =
            process.env.HAPPYM_APPLIANCE_SYSTEM_ORGANIZATION_ID ||
            'happym-system';
          if (
            process.env.HAPPYM_APPLIANCE_MODE !== 'true' ||
            credentialOrg.id !== systemOrgId
          ) {
            res
              .status(HttpStatus.FORBIDDEN)
              .json({ msg: 'Organization scope is not allowed' });
            return;
          }
          const scopedOrg = await this._organizationService.getOrgById(
            requestedOrgId
          );
          if (!scopedOrg) {
            res
              .status(HttpStatus.NOT_FOUND)
              .json({ msg: 'Organization scope was not found' });
            return;
          }
          org = { ...credentialOrg, ...scopedOrg };
        }

        if (!!process.env.STRIPE_SECRET_KEY && !org.subscription) {
          res
            .status(HttpStatus.UNAUTHORIZED)
            .json({ msg: 'No subscription found' });
          return;
        }

        // @ts-ignore
        req.org = { ...org, users: [{ users: { role: 'SUPERADMIN' } }] };
      }
    } catch (err) {
      throw new HttpForbiddenException();
    }

    setSentryUserContext({
      // @ts-ignore
      orgId: req.org.id,
      // @ts-ignore
      paymentId: req.org.paymentId,
    });
    next();
  }
}
