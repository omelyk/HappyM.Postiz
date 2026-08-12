export type HappyMComposerLanguage = 'en' | 'it';
export type HappyMComposerTheme = 'light' | 'dark';

export type HappyMComposerPreferences = {
  language: HappyMComposerLanguage;
  theme: HappyMComposerTheme;
};

const normalizeLanguage = (value: string | null): HappyMComposerLanguage =>
  value?.trim().toLowerCase().startsWith('it') ? 'it' : 'en';

const normalizeTheme = (value: string | null): HappyMComposerTheme =>
  value?.trim().toLowerCase() === 'light' ? 'light' : 'dark';

export const resolveHappyMComposerPreferences = (
  lang: string | null,
  lng: string | null,
  theme: string | null,
  mode: string | null
): HappyMComposerPreferences => ({
  language: normalizeLanguage(lang || lng),
  theme: normalizeTheme(theme || mode),
});

export const appendHappyMComposerPreferences = (
  redirectUrl: string,
  preferences: HappyMComposerPreferences
) => {
  const separator = redirectUrl.includes('?') ? '&' : '?';
  return `${redirectUrl}${separator}lang=${preferences.language}&theme=${preferences.theme}`;
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
  document.documentElement.lang = language;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
};
