import {
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthService as AuthChecker } from '@gitroom/helpers/auth/auth.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { sign } from 'jsonwebtoken';
import {
  HappyMEmbedSessionClaims,
  HappyMEmbedSessionContext,
} from './happym.embed.types';

@Injectable()
export class HappyMEmbedService {
  constructor(
    private readonly _usersService: UsersService,
    private readonly _organizationService: OrganizationService,
    private readonly _integrationService: IntegrationService
  ) {}

  async exchangeTicket(ticket: string) {
    const exchangeUrl = process.env.HAPPYM_EMBED_EXCHANGE_URL;
    const clientId = process.env.HAPPYM_EMBED_CLIENT_ID;
    const clientSecret = process.env.HAPPYM_EMBED_CLIENT_SECRET;
    const sessionSecret = process.env.HAPPYM_EMBED_SESSION_SECRET;

    if (!exchangeUrl || !clientId || !clientSecret || !sessionSecret) {
      throw new ServiceUnavailableException(
        'HappyM embed ticket exchange is not configured'
      );
    }

    let response: Response;
    try {
      response = await fetch(exchangeUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-HappyM-Client-Id': clientId,
          Authorization: `Bearer ${clientSecret}`,
        },
        body: JSON.stringify({ ticket }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'HappyM embed ticket exchange is unavailable'
      );
    }

    if (!response.ok) {
      const supportedStatus = [400, 401, 403, 409, 410].includes(
        response.status
      )
        ? response.status
        : 502;
      throw new HttpException(
        'HappyM embed ticket exchange failed',
        supportedStatus
      );
    }

    const context = (await response.json()) as HappyMEmbedSessionContext;
    await this.validateContext(context);

    const user = await this._usersService.getUserById(context.postizUserId);
    if (!user?.activated) {
      throw new ForbiddenException('Invalid Postiz embed user');
    }

    const organizations = await this._organizationService.getOrgsByUserId(
      user.id
    );
    const organization = organizations.find(
      (item) =>
        item.id === context.postizOrganizationId && !item.users?.[0]?.disabled
    );
    if (!organization) {
      throw new ForbiddenException(
        'Embed user is not a member of the organization'
      );
    }

    const availableIntegrations =
      await this._integrationService.getIntegrationsList(organization.id);
    const availableIds = new Set(availableIntegrations.map((item) => item.id));
    if (context.allowedIntegrationIds.some((id) => !availableIds.has(id))) {
      throw new ForbiddenException('Embed integration allow-list is invalid');
    }

    const ttlSeconds = Math.min(
      Math.max(
        Number(process.env.HAPPYM_EMBED_SESSION_TTL_SECONDS || 3600),
        60
      ),
      7200
    );
    const sessionExpiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const claims: HappyMEmbedSessionClaims = {
      ...context,
      kind: 'happym-embed',
      expiresAt: sessionExpiresAt.toISOString(),
    };
    const embedSession = sign(claims, sessionSecret, {
      algorithm: 'HS256',
      expiresIn: ttlSeconds,
    });

    const { password: _password, ...sanitizedUser } = user;
    return {
      auth: AuthChecker.signJWT(sanitizedUser),
      organizationId: organization.id,
      embedSession,
      context: claims,
      ttlSeconds,
    };
  }

  private async validateContext(context: HappyMEmbedSessionContext) {
    const requiredStrings: Array<keyof HappyMEmbedSessionContext> = [
      'postizUserId',
      'postizOrganizationId',
      'tenantId',
      'pharmacyId',
      'userId',
      'origin',
      'correlationId',
      'expiresAt',
    ];
    if (
      !context ||
      requiredStrings.some(
        (key) => typeof context[key] !== 'string' || !context[key]
      ) ||
      !Array.isArray(context.allowedIntegrationIds) ||
      context.allowedIntegrationIds.some((id) => typeof id !== 'string')
    ) {
      throw new ForbiddenException('HappyM embed context is malformed');
    }

    const ticketExpiresAt = new Date(context.expiresAt).getTime();
    if (!Number.isFinite(ticketExpiresAt) || ticketExpiresAt <= Date.now()) {
      throw new HttpException('HappyM embed ticket has expired', 410);
    }

    let normalizedOrigin: string;
    try {
      normalizedOrigin = new URL(context.origin).origin;
    } catch {
      throw new ForbiddenException('HappyM embed origin is invalid');
    }

    const allowedOrigins = (process.env.HAPPYM_EMBED_ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return '';
        }
      })
      .filter(Boolean);
    if (!allowedOrigins.includes(normalizedOrigin)) {
      throw new ForbiddenException('HappyM embed origin is not allowed');
    }
    context.origin = normalizedOrigin;
    context.allowedIntegrationIds = [...new Set(context.allowedIntegrationIds)];
  }
}
