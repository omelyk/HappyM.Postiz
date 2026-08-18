import { ConflictException, Injectable } from '@nestjs/common';
import { youtubeRedirectUri } from '@gitroom/nestjs-libraries/integrations/social/youtube.redirect-uri';

export type ProviderConfigurationStatus = {
  provider: 'facebook';
  configured: boolean;
  appIdMasked: string | null;
};

export type SetFacebookOAuthAppRequest = {
  appId: string;
  appSecret?: string;
};

@Injectable()
export class HappyMProviderConfigurationService {
  constructor() {
    this.applyEnvironmentAliases();
  }

  getProvidersStatus() {
    return {
      providers: [this.getFacebookStatus(), this.getYoutubeStatus()],
    };
  }

  getFacebookStatus(): ProviderConfigurationStatus {
    const appId = process.env.FACEBOOK_APP_ID?.trim() || '';
    const appSecret = process.env.FACEBOOK_APP_SECRET || '';
    return {
      provider: 'facebook',
      configured: !!appId && !!appSecret,
      appIdMasked: appId ? this.mask(appId) : null,
    };
  }

  getYoutubeStatus() {
    return {
      provider: 'youtube' as const,
      configured:
        !!process.env.YOUTUBE_CLIENT_ID?.trim() &&
        !!process.env.YOUTUBE_CLIENT_SECRET,
      redirectUri: youtubeRedirectUri(),
    };
  }

  setFacebookOAuthApp(body: SetFacebookOAuthAppRequest) {
    const appId = this.credential(body?.appId, 'appId');
    const currentSecret = process.env.FACEBOOK_APP_SECRET || '';
    const appSecret =
      body?.appSecret === undefined
        ? currentSecret
        : this.credential(body.appSecret, 'appSecret');
    if (!appSecret) {
      throw new ConflictException('appSecret is required on first setup');
    }

    // The upstream providers read these values for every OAuth operation, so
    // changing the canonical runtime environment applies without a restart.
    process.env.FACEBOOK_APP_ID = appId;
    process.env.FACEBOOK_APP_SECRET = appSecret;

    return this.getFacebookStatus();
  }

  private applyEnvironmentAliases() {
    process.env.FACEBOOK_APP_ID =
      process.env.FACEBOOK_APP_ID?.trim() ||
      process.env.PHARMA_FACEBOOK_APP_ID?.trim() ||
      '';
    process.env.FACEBOOK_APP_SECRET =
      process.env.FACEBOOK_APP_SECRET ||
      process.env.PHARMA_FACEBOOK_APP_SECRET ||
      '';
  }

  private credential(value: string | undefined, name: string) {
    const normalized = value?.trim() || '';
    if (!normalized || normalized.length > 512) {
      throw new ConflictException(`${name} is invalid`);
    }
    return normalized;
  }

  private mask(value: string) {
    const visible = value.slice(-4);
    return `${'*'.repeat(Math.max(4, Math.min(12, value.length - visible.length)))}${visible}`;
  }
}
