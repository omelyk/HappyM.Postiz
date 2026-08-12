export type HappyMComposerLanguage = 'en' | 'it';
export type HappyMComposerTheme = 'light' | 'dark';
export type HappyMComposerChrome = 'host' | 'social-manager';

export type HappyMComposerPreferences = {
  language: HappyMComposerLanguage;
  theme: HappyMComposerTheme;
  chrome: HappyMComposerChrome;
};

const normalizeLanguage = (value: string | null): HappyMComposerLanguage =>
  value?.trim().toLowerCase().startsWith('it') ? 'it' : 'en';

const normalizeTheme = (value: string | null): HappyMComposerTheme =>
  value?.trim().toLowerCase() === 'light' ? 'light' : 'dark';

export const resolveHappyMComposerPreferences = (
  lang: string | null,
  lng: string | null,
  theme: string | null,
  mode: string | null,
  chrome: string | null = null,
  embedChrome: string | null = null
): HappyMComposerPreferences => ({
  language: normalizeLanguage(lang || lng),
  theme: normalizeTheme(theme || mode),
  chrome:
    (chrome || embedChrome)?.trim().toLowerCase() === 'host'
      ? 'host'
      : 'social-manager',
});

export const appendHappyMComposerPreferences = (
  redirectUrl: string,
  preferences: HappyMComposerPreferences
) => {
  const separator = redirectUrl.includes('?') ? '&' : '?';
  return `${redirectUrl}${separator}lang=${preferences.language}&theme=${preferences.theme}&chrome=${preferences.chrome}`;
};

export const persistHappyMComposerPreferences = (
  preferences: HappyMComposerPreferences
) => {
  const { language, theme } = preferences;
  for (const cookieName of ['i18next', 'i18nextLng', 'NEXT_LOCALE']) {
    document.cookie = `${cookieName}=${language}; Path=/; SameSite=Lax`;
  }
  window.localStorage.setItem('i18nextLng', language);
  window.localStorage.setItem('language', language);
  window.localStorage.setItem('NEXT_LOCALE', language);
  window.localStorage.setItem('happym_embed_theme', theme);
  window.localStorage.setItem('happym_embed_chrome', preferences.chrome);
  document.documentElement.lang = language;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
};
