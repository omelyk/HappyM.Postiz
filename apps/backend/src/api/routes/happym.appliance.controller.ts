import { Body, Controller, Get, Header, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  EnsureOrganizationRequest,
  EnsureUserRequest,
  HappyMApplianceService,
} from '@gitroom/backend/services/happym-appliance/happym.appliance.service';
import {
  HappyMProviderConfigurationService,
  SetFacebookOAuthAppRequest,
} from '@gitroom/backend/services/happym-appliance/happym.provider-configuration.service';

@ApiTags('HappyM Appliance')
@Controller('/internal/happym/appliance/health')
export class HappyMApplianceHealthController {
  constructor(private readonly appliance: HappyMApplianceService) {}

  @Get('/')
  @Header('Cache-Control', 'no-store')
  health() {
    return this.appliance.health();
  }
}

@ApiTags('HappyM Appliance')
@Controller('/internal/happym/appliance')
export class HappyMApplianceController {
  constructor(private readonly appliance: HappyMApplianceService) {}

  @Get('/linked')
  linked() {
    return this.appliance.status();
  }

  @Post('/credentials/provision')
  provisionCredentials() {
    return this.appliance.provisionCredentials();
  }

  @Post('/credentials/rotate')
  rotateCredentials() {
    return this.appliance.rotateCredentials();
  }

  @Post('/organizations/ensure')
  ensureOrganization(@Body() body: EnsureOrganizationRequest) {
    return this.appliance.ensureOrganization(body);
  }

  @Post('/users/ensure')
  ensureUser(@Body() body: EnsureUserRequest) {
    return this.appliance.ensureUser(body);
  }

  @Post('/admin/password/reset')
  resetAdminPassword(@Body() body: { password: string }) {
    return this.appliance.resetAdminPassword(body?.password);
  }
}

@ApiTags('Social Manager Providers')
@Controller('/appliance/providers')
export class HappyMProviderConfigurationController {
  constructor(
    private readonly providers: HappyMProviderConfigurationService
  ) {}

  @Get('/')
  getProvidersStatus() {
    return this.providers.getProvidersStatus();
  }

  @Get('/facebook')
  getFacebookStatus() {
    return this.providers.getFacebookStatus();
  }

  @Get('/youtube')
  getYoutubeStatus() {
    return this.providers.getYoutubeStatus();
  }

  @Put('/facebook')
  setFacebookOAuthApp(@Body() body: SetFacebookOAuthAppRequest) {
    const { configured, appIdMasked } =
      this.providers.setFacebookOAuthApp(body);
    return { configured, appIdMasked };
  }
}
