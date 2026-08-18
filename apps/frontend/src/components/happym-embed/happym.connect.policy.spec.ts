import {
  HAPPYM_CONNECT_FLOW_MARKER,
  happyMProviderNotConfiguredMessage,
  happyMConnectErrorMessage,
  isHappyMConnectPath,
} from './happym.connect.policy';

describe('HappyM Connect no-login policy', () => {
  it('recognizes every connect route variant', () => {
    expect(isHappyMConnectPath('/embed/happym/connect')).toBe(true);
    expect(isHappyMConnectPath('/embed/happym/connect/callback')).toBe(true);
    expect(isHappyMConnectPath('/embed/happym/composer')).toBe(false);
    expect(HAPPYM_CONNECT_FLOW_MARKER).toBe('happym-connect-flow');
  });

  it('creates the CRM provider configuration event without internal details', () => {
    const message = happyMProviderNotConfiguredMessage('facebook');

    expect(message).toEqual({
      socialManager: 'provider_not_configured',
      provider: 'facebook',
      errorCode: 'provider_not_configured',
    });
    expect(JSON.stringify(message)).not.toMatch(/postiz|appliance|facebook_app/i);
  });

  it('returns operator-safe Italian and English errors without login branding', () => {
    const italian = happyMConnectErrorMessage(
      'provider_not_configured',
      'facebook',
      'it-IT'
    );
    const english = happyMConnectErrorMessage(
      'session_expired',
      'facebook',
      'en-US'
    );

    expect(italian).toContain('Facebook non è configurato');
    expect(english).toContain('session has expired');
    expect(`${italian} ${english}`).not.toMatch(/postiz|sign in|password/i);
  });
});
