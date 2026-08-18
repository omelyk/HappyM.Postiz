export type HappyMDevLoginHint = {
  email: string;
  password: string;
};

const normalizeEmail = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized.includes('@') ? normalized : `${normalized}@happym.local`;
};

export const happyMDevLoginHint = (
  environment: NodeJS.ProcessEnv = process.env
): HappyMDevLoginHint | undefined => {
  if (
    environment.HAPPYM_APPLIANCE_MODE !== 'true' ||
    environment.HAPPYM_DEV_LOGIN_HINT !== 'true'
  ) {
    return undefined;
  }

  const login = environment.HAPPYM_DEV_LOGIN_EMAIL || 'superadmin@happym.local';

  return {
    email: normalizeEmail(login),
    password: environment.HAPPYM_DEV_LOGIN_PASSWORD || 'Demo123456',
  };
};
