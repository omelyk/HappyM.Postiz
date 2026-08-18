import { isHappyMConnectProviderConfigured } from './happym.connect.provider-configuration';

describe('HappyM Connect provider configuration', () => {
  it('requires both Facebook OAuth credentials', () => {
    expect(
      isHappyMConnectProviderConfigured('facebook', {
        FACEBOOK_APP_ID: 'app-id',
      })
    ).toBe(false);
    expect(
      isHappyMConnectProviderConfigured('facebook', {
        FACEBOOK_APP_ID: 'app-id',
        FACEBOOK_APP_SECRET: 'app-secret',
      })
    ).toBe(true);
  });

  it('accepts either dedicated GMB or YouTube credentials for GMB', () => {
    expect(
      isHappyMConnectProviderConfigured('gmb', {
        YOUTUBE_CLIENT_ID: 'client-id',
        YOUTUBE_CLIENT_SECRET: 'client-secret',
      })
    ).toBe(true);
    expect(isHappyMConnectProviderConfigured('gmb', {})).toBe(false);
  });

  it('leaves providers without appliance credentials to their native flow', () => {
    expect(isHappyMConnectProviderConfigured('wordpress', {})).toBe(true);
  });
});
