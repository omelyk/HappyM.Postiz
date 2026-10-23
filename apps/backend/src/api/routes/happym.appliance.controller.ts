import {
  Body,
  Param,
  Controller,
  Get,
  Header,
  Headers,
  Post,
  Put,
  ServiceUnavailableException,
} from '@nestjs/common';
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
import { HappyMActivationReadinessService } from '@gitroom/backend/services/happym-appliance/happym.activation-readiness.service';

@ApiTags('HappyM Appliance')
@Controller('/internal/happym/appliance/health')
export class HappyMApplianceHealthController {
  constructor(private readonly appliance: HappyMApplianceService) {}

  @Get('/')
  @Header('Cache-Control', 'no-store')
  async health() {
    const health = await this.appliance.health();
    if (!health.ready && health.reasonCode === 'mastra_pg_schema') {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}

@ApiTags('HappyM Appliance')
@Controller('/internal/happym/appliance')
export class HappyMApplianceController {
  constructor(private readonly appliance: HappyMApplianceService,
    private readonly activationReadiness: HappyMActivationReadinessService) {}

  @Get('/activation-readiness')
  @Header('Cache-Control', 'no-store')
  activation(@Headers('x-happym-probe-nonce') nonce: unknown) {
    return this.activationReadiness.observe(nonce);
  }

  @Get('/activation-readiness/capabilities30')
  @Header('Cache-Control', 'no-store')
  consumerCapabilities30(@Headers('x-happym-probe-nonce') nonce: unknown,
    @Headers('x-happym-native-fixture-authorization') purpose: unknown,
    @Headers('x-happym-native-embed-authorization30') embed: unknown,
    @Headers('x-happym-native-system-authorization30') systemKey: unknown,
    @Headers('x-happym-native-system-organization30') systemOrganization: unknown) {
    return this.activationReadiness.observeCapabilities30(nonce, purpose, embed, systemKey, systemOrganization);
  }

  @Get('/activation-readiness/consumer30/:admissionId')
  @Header('Cache-Control', 'no-store')
  consumerReadiness30(@Headers('x-happym-probe-nonce') nonce: unknown, @Param('admissionId') admissionId: string) {
    return this.activationReadiness.observeConsumer30(nonce, admissionId);
  }

  @Post('/native-consumer/enroll30')
  @Header('Cache-Control', 'no-store')
  enrollConsumer30(@Body() body: unknown, @Headers('x-happym-native-fixture-authorization') credential: unknown) {
    return this.appliance.enrollNativeConsumer30(body, credential);
  }

  @Post('/native-consumer/bootstrap30')
  @Header('Cache-Control', 'no-store')
  bootstrapConsumer30(@Body() body: unknown, @Headers('x-happym-native-fixture-authorization') credential: unknown) {
    return this.appliance.bootstrapSharedNativeConsumer30(body, credential);
  }

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

  // QA-only native TEST ingress. No browser/public credential DTO or ordinary
  // consumer key fallback. The existing controller M2M middleware still applies.
  @Post('/native-consumer/bootstrap')
  @Header('Cache-Control', 'no-store')
  bootstrapNativeConsumer(@Body() body: unknown,
    @Headers('x-happym-native-fixture-authorization') credential: unknown) {
    return this.appliance.bootstrapNativeConsumer(body, credential);
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
  constructor(private readonly providers: HappyMProviderConfigurationService) {}

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
