import { Body, Controller, Get, Header, Headers, Post, Query } from '@nestjs/common';
import { SyntheticFixtureService, SyntheticReadback } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';

// Registered explicitly under existing appliance M2M middleware. No browser route.
@Controller('/internal/happym/appliance/test-fixture')
export class HappyMSyntheticFixtureController {
  constructor(private readonly fixture: SyntheticFixtureService) {}

  @Post('/provision')
  @Header('Cache-Control', 'no-store')
  provision(@Body() input: unknown, @Headers('x-happym-native-fixture-authorization') credential: string | undefined) {
    return this.fixture.provision(input, credential);
  }

  @Get('/receipts')
  @Header('Cache-Control', 'no-store')
  readback(@Query('organizationId') organizationId: string, @Query('postId') postId: string,
    @Query('occurrenceId') occurrenceId: string): Promise<SyntheticReadback> {
    return this.fixture.readback(organizationId, postId, occurrenceId);
  }
}
