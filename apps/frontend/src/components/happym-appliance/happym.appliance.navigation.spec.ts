import {
  happyMApplianceHomePath,
  shouldCloseLaunchesPopup,
  isApplianceAdministrator,
} from './happym.appliance.navigation';

describe('Social Manager appliance navigation', () => {
  it('uses the stable settings page as the appliance admin landing', () => {
    expect(happyMApplianceHomePath(true, true)).toBe('/settings');
    expect(happyMApplianceHomePath(false, true)).toBe('/launches');
    expect(happyMApplianceHomePath(false, false)).toBe('/analytics');
  });

  it('does not close an ordinary admin console that has an opener', () => {
    expect(shouldCloseLaunchesPopup(true, null, null)).toBe(false);
  });

  it('still closes an OAuth callback popup after a result', () => {
    expect(shouldCloseLaunchesPopup(true, 'Connected', null)).toBe(true);
    expect(shouldCloseLaunchesPopup(true, null, 'true')).toBe(true);
    expect(shouldCloseLaunchesPopup(false, 'Connected', null)).toBe(false);
  });
});

describe('Social Manager appliance administrator exposure', () => {
  it('exposes original administration for the database SuperAdmin in its current SuperAdmin membership', () => {
    expect(isApplianceAdministrator({
      isSuperAdmin: true, role: 'SUPERADMIN', orgId: 'assigned-organization',
    })).toBe(true);
  });

  it.each([
    undefined,
    null,
    { role: 'SUPERADMIN', orgId: 'assigned-organization' },
    { isSuperAdmin: false, role: 'SUPERADMIN', orgId: 'assigned-organization' },
    { isSuperAdmin: true, role: 'ADMIN', orgId: 'assigned-organization' },
    { isSuperAdmin: true, role: 'USER', orgId: 'assigned-organization' },
    { isSuperAdmin: true, role: 'SUPERADMIN' },
    { isSuperAdmin: true, role: 'SUPERADMIN', orgId: '' },
  ])('retains the restricted appliance landing for an unqualified context %#', (user) => {
    expect(isApplianceAdministrator(user)).toBe(false);
  });
});
