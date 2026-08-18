import { happyMDevLoginHint } from '@gitroom/nestjs-libraries/happym-appliance/happym.dev-login';

describe('Social Manager local demo login', () => {
  it('is absent unless both appliance mode and the explicit hint flag are on', () => {
    expect(
      happyMDevLoginHint({ HAPPYM_APPLIANCE_MODE: 'true' })
    ).toBeUndefined();
    expect(
      happyMDevLoginHint({
        HAPPYM_APPLIANCE_MODE: 'false',
        HAPPYM_DEV_LOGIN_HINT: 'true',
      })
    ).toBeUndefined();
  });

  it('maps the documented local alias to an email accepted by the login form', () => {
    expect(
      happyMDevLoginHint({
        HAPPYM_APPLIANCE_MODE: 'true',
        HAPPYM_DEV_LOGIN_HINT: 'true',
        HAPPYM_DEV_LOGIN_EMAIL: 'superadmin',
        HAPPYM_DEV_LOGIN_PASSWORD: 'Demo123456',
      })
    ).toEqual({
      email: 'superadmin@happym.local',
      password: 'Demo123456',
    });
  });

  it('does not expose or overwrite the production administrator credentials', () => {
    expect(
      happyMDevLoginHint({
        HAPPYM_APPLIANCE_MODE: 'true',
        HAPPYM_DEV_LOGIN_HINT: 'true',
        HAPPYM_APPLIANCE_ADMIN_EMAIL: 'admin@pharma.local',
        HAPPYM_APPLIANCE_ADMIN_PASSWORD: 'production-secret-password',
      })
    ).toEqual({
      email: 'superadmin@happym.local',
      password: 'Demo123456',
    });
  });
});
