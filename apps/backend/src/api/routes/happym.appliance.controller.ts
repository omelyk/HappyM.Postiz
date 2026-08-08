import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  EnsureOrganizationRequest,
  EnsureUserRequest,
  HappyMApplianceService,
} from '@gitroom/backend/services/happym-appliance/happym.appliance.service';

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
