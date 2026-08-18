import { HappyMProviderConfigurationService } from './happym.provider-configuration.service';

describe('HappyMProviderConfigurationService', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    delete process.env.PHARMA_FACEBOOK_APP_ID;
    delete process.env.PHARMA_FACEBOOK_APP_SECRET;
  });

  afterAll(() => {
    process.env = original;
  });

  it('uses the Pharma aliases at startup', () => {
    process.env.PHARMA_FACEBOOK_APP_ID = 'alias-app-1234';
    process.env.PHARMA_FACEBOOK_APP_SECRET = 'alias-secret';

    const service = new HappyMProviderConfigurationService();

    expect(service.getFacebookStatus()).toEqual({
      provider: 'facebook',
      configured: true,
      appIdMasked: '**********1234',
    });
    expect(process.env.FACEBOOK_APP_SECRET).toBe('alias-secret');
  });

  it('hot-applies credentials without returning the secret', () => {
    const service = new HappyMProviderConfigurationService();

    const status = service.setFacebookOAuthApp({
      appId: 'facebook-app-9876',
      appSecret: 'top-secret',
    });

    expect(status).toEqual({
      provider: 'facebook',
      configured: true,
      appIdMasked: '************9876',
    });
    expect(JSON.stringify(status)).not.toContain('top-secret');
    expect(process.env.FACEBOOK_APP_SECRET).toBe('top-secret');
  });

  it('keeps the existing secret when an update omits it', () => {
    process.env.FACEBOOK_APP_ID = 'old-app';
    process.env.FACEBOOK_APP_SECRET = 'existing-secret';
    const service = new HappyMProviderConfigurationService();

    service.setFacebookOAuthApp({ appId: 'new-app-4321' });

    expect(process.env.FACEBOOK_APP_ID).toBe('new-app-4321');
    expect(process.env.FACEBOOK_APP_SECRET).toBe('existing-secret');
  });

  it('requires the secret on first setup', () => {
    const service = new HappyMProviderConfigurationService();

    expect(() => service.setFacebookOAuthApp({ appId: 'new-app' })).toThrow(
      'appSecret is required on first setup'
    );
  });
});
