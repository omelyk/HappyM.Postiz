export const isHappyMApplianceMode = () =>
  process.env.HAPPYM_APPLIANCE_MODE === 'true' ||
  process.env.NEXT_PUBLIC_HAPPYM_APPLIANCE_MODE === 'true';

export const happyMProductName = () =>
  process.env.HAPPYM_PRODUCT_NAME || 'Social Manager';

export const happyMPageTitle = (page?: string) =>
  [happyMProductName(), page].filter(Boolean).join(' · ');
