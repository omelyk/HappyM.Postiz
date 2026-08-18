export type HappyMConnectErrorKind =
  | 'invalid_provider'
  | 'exchange_failed'
  | 'session_expired'
  | 'provider_not_configured'
  | 'provider_unavailable';

export const isHappyMConnectPath = (pathname: string) =>
  pathname === '/embed/happym/connect' ||
  pathname.startsWith('/embed/happym/connect/');

export const HAPPYM_CONNECT_FLOW_MARKER = 'happym-connect-flow';

export const happyMProviderNotConfiguredMessage = (provider: string) => ({
  socialManager: 'provider_not_configured' as const,
  provider,
  errorCode: 'provider_not_configured' as const,
});

export const happyMConnectErrorMessage = (
  kind: HappyMConnectErrorKind,
  provider: string,
  language: string
) => {
  const italian = language.toLowerCase().startsWith('it');
  const channel = provider
    ? `${provider.charAt(0).toUpperCase()}${provider.slice(1)}`
    : italian
    ? 'Il canale'
    : 'The channel';

  const messages: Record<HappyMConnectErrorKind, [string, string]> = {
    invalid_provider: [
      'Il canale richiesto non è valido. Chiudi questa finestra e riprova dal CRM.',
      'The requested channel is invalid. Close this window and try again from the CRM.',
    ],
    exchange_failed: [
      'Il collegamento non è più valido. Chiudi questa finestra e riprova dal CRM.',
      'This connection request is no longer valid. Close this window and try again from the CRM.',
    ],
    session_expired: [
      'La sessione di collegamento è scaduta. Chiudi questa finestra e riprova dal CRM.',
      'The connection session has expired. Close this window and try again from the CRM.',
    ],
    provider_not_configured: [
      `${channel} non è configurato in Social Manager. Contatta l’amministratore.`,
      `${channel} is not configured in Social Manager. Contact the administrator.`,
    ],
    provider_unavailable: [
      `Impossibile avviare il collegamento a ${channel}. Riprova più tardi o contatta l’amministratore.`,
      `Unable to start the ${channel} connection. Try again later or contact the administrator.`,
    ],
  };

  return messages[kind][italian ? 0 : 1];
};
