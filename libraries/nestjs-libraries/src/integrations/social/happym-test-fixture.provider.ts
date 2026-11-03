import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { AuthTokenDetails, GenerateAuthUrlResponse, PostResponse, SocialProvider, PendingCheckResponse } from './social.integrations.interface';
import { ApplicationFailure } from '@temporalio/common';

/** Metadata/validation only. Delivery is a separate DB-only workflow branch;
 * this class cannot mint OAuth credentials or fake a real provider response. */
export class HappyMTestFixtureProvider extends SocialAbstract implements SocialProvider {
  identifier = 'happym-test-fixture';
  name = '[SIMULAZIONE] HappyM TEST';
  editor = 'normal' as const;
  isBetweenSteps = false;
  scopes: string[] = [];
  maxLength() { return 10000; }
  override async checkValidity() { return true as const; }
  private denied(): never {
    throw ApplicationFailure.nonRetryable('synthetic_fixture_transport_forbidden', 'SyntheticFixtureTransportForbidden');
  }
  async authenticate(): Promise<AuthTokenDetails> { return this.denied(); }
  async generateAuthUrl(): Promise<GenerateAuthUrlResponse> { return this.denied(); }
  async refreshToken(): Promise<AuthTokenDetails> { return this.denied(); }
  async post(): Promise<PostResponse[]> { return this.denied(); }
  async postPending(): Promise<PostResponse[]> { return this.denied(); }
  override async checkPostStatus(): Promise<PendingCheckResponse> { return this.denied(); }
  override async finalizePost(): Promise<PendingCheckResponse> { return this.denied(); }
}
