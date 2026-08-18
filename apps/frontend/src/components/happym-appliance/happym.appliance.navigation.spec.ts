import {
  happyMApplianceHomePath,
  shouldCloseLaunchesPopup,
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
