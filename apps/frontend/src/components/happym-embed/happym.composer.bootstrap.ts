export type HappyMComposerBootstrapSession = {
  active: boolean;
  purpose: string;
};

export const canMountHappyMComposerShell = (
  ticket: string | null,
  session?: HappyMComposerBootstrapSession
) => !ticket && session?.active === true && session.purpose === 'composer';
