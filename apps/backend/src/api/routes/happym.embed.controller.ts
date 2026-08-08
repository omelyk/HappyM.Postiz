import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { ExchangeHappyMEmbedTicketDto } from '@gitroom/nestjs-libraries/dtos/happym-embed/exchange.happym.embed.ticket.dto';
import { GetHappyMEmbedContext } from '@gitroom/backend/services/happym-embed/happym.embed.context';
import { HappyMEmbedService } from '@gitroom/backend/services/happym-embed/happym.embed.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { Organization } from '@prisma/client';
import {
  HAPPYM_EMBED_COOKIE,
  HappyMEmbedSessionClaims,
} from '@gitroom/backend/services/happym-embed/happym.embed.types';

@ApiTags('HappyM Embed')
@Controller('/happym/embed-sessions')
export class HappyMEmbedExchangeController {
  constructor(private readonly _happyMEmbedService: HappyMEmbedService) {}

  @Post('/exchange')
  async exchange(
    @Body() body: ExchangeHappyMEmbedTicketDto,
    @Res({ passthrough: false }) response: Response
  ) {
    const session = await this._happyMEmbedService.exchangeTicket(
      body.ticket,
      body.purpose,
      body.provider
    );
    const secured = !process.env.NOT_SECURED;
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: secured,
      sameSite: secured ? ('none' as const) : ('lax' as const),
      maxAge: session.ttlSeconds * 1000,
      ...(secured
        ? { domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!) }
        : {}),
    };

    response.cookie('auth', session.auth, cookieOptions);
    response.cookie('showorg', session.organizationId, cookieOptions);
    response.cookie(HAPPYM_EMBED_COOKIE, session.embedSession, cookieOptions);
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({
      redirectUrl:
        session.context.purpose === 'connect'
          ? `/embed/happym/connect?provider=${encodeURIComponent(
              session.context.provider!
            )}`
          : '/embed/happym/composer',
      expiresAt: session.context.expiresAt,
      correlationId: session.context.correlationId,
    });
  }
}

@ApiTags('HappyM Embed')
@Controller('/happym/embed-sessions')
export class HappyMEmbedSessionController {
  @Get('/current')
  current(@GetHappyMEmbedContext() context?: HappyMEmbedSessionClaims) {
    if (!context) {
      return { active: false };
    }
    return {
      active: true,
      origin: context.origin,
      tenantId: context.tenantId,
      pharmacyId: context.pharmacyId,
      correlationId: context.correlationId,
      expiresAt: context.expiresAt,
      purpose: context.purpose,
      provider: context.provider || null,
    };
  }

  @Get('/user')
  composerUser(
    @GetHappyMEmbedContext() context: HappyMEmbedSessionClaims,
    @GetOrgFromRequest() organization: Organization
  ) {
    return {
      id: context.postizUserId,
      orgId: context.postizOrganizationId,
      email: '',
      name: 'HappyM',
      role: 'USER',
      publicApi: '',
      totalChannels: !process.env.STRIPE_PUBLISHABLE_KEY
        ? 10000
        : // @ts-ignore subscription is loaded on the request organization
          organization?.subscription?.totalChannels || pricing.FREE.channel,
      tier:
        // @ts-ignore subscription is loaded on the request organization
        organization?.subscription?.subscriptionTier ||
        (!process.env.STRIPE_PUBLISHABLE_KEY ? 'ULTIMATE' : 'FREE'),
      isLifetime: false,
      admin: false,
      impersonate: false,
      isTrailing: false,
      allowTrial: false,
      streakSince: null as string | null,
    };
  }
}
