import {
  appendHappyMComposerPreferences,
  resolveHappyMComposerPreferences,
} from './happym.composer.preferences';

describe('HappyM composer host preferences', () => {
  it('normalizes CRM language and theme aliases', () => {
    expect(
      resolveHappyMComposerPreferences('it-IT', null, null, 'light')
    ).toEqual({ language: 'it', theme: 'light' });
    expect(
      resolveHappyMComposerPreferences(null, 'en-US', 'dark', null)
    ).toEqual({ language: 'en', theme: 'dark' });
  });

  it('uses safe supported defaults for invalid host values', () => {
    expect(
      resolveHappyMComposerPreferences('fr', null, 'auto', null)
    ).toEqual({ language: 'en', theme: 'dark' });
  });

  it('preserves normalized preferences after the ticket redirect', () => {
    expect(
      appendHappyMComposerPreferences('/embed/happym/composer', {
        language: 'it',
        theme: 'light',
      })
    ).toBe('/embed/happym/composer?lang=it&theme=light');
  });

  it('lets the current CRM aliases override persisted fallback values', () => {
    expect(
      resolveHappyMComposerPreferences('it', null, 'light', null)
    ).toEqual({ language: 'it', theme: 'light' });
  });
});
