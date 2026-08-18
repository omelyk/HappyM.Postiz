'use client';

import { FC, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  HAPPYM_CONNECT_FLOW_MARKER,
  happyMConnectErrorMessage,
  happyMProviderNotConfiguredMessage,
  HappyMConnectErrorKind,
} from './happym.connect.policy';

type ConnectSession = {
  active: boolean;
  origin: string;
  purpose: 'composer' | 'connect';
  provider: string | null;
};

export const HappyMConnect: FC = () => {
  const fetch = useFetch();
  const searchParams = useSearchParams();
  const ticket = searchParams.get('ticket');
  const provider = searchParams.get('provider');
  const [error, setError] = useState<HappyMConnectErrorKind>();

  useEffect(() => {
    const initialize = async () => {
      try {
        window.sessionStorage.setItem(HAPPYM_CONNECT_FLOW_MARKER, 'true');
        if (!provider || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(provider)) {
          setError('invalid_provider');
          return;
        }

        if (ticket) {
          const exchange = await fetch('/happym/embed-sessions/exchange', {
            method: 'POST',
            body: JSON.stringify({ ticket, purpose: 'connect', provider }),
          });
          if (!exchange.ok) {
            setError('exchange_failed');
            return;
          }
          const result = await exchange.json();
          window.location.replace(result.redirectUrl);
          return;
        }

        const currentResponse = await fetch('/happym/embed-sessions/current');
        if (!currentResponse.ok) {
          setError('session_expired');
          return;
        }
        const current = (await currentResponse.json()) as ConnectSession;
        if (
          !current.active ||
          current.purpose !== 'connect' ||
          current.provider !== provider
        ) {
          setError('session_expired');
          return;
        }

        const returnUrl = `${
          current.origin
        }/?socialManager=connected&provider=${encodeURIComponent(provider)}`;
        const connectResponse = await fetch(
          `/integrations/social/${encodeURIComponent(
            provider
          )}?redirectUrl=${encodeURIComponent(returnUrl)}`
        );
        if (!connectResponse.ok) {
          setError(
            connectResponse.status === 401 || connectResponse.status === 403
              ? 'session_expired'
              : 'provider_unavailable'
          );
          return;
        }
        const connect = (await connectResponse.json()) as {
          url?: string;
          err?: boolean;
          errorCode?: 'provider_not_configured' | 'provider_unavailable';
        };
        if (!connect.url || connect.err) {
          const errorCode = connect.errorCode || 'provider_unavailable';
          if (errorCode === 'provider_not_configured' && window.opener) {
            window.opener.postMessage(
              happyMProviderNotConfiguredMessage(provider),
              current.origin
            );
          }
          setError(errorCode);
          return;
        }
        window.location.replace(connect.url);
      } catch {
        setError('provider_unavailable');
      }
    };

    initialize();
  }, [fetch, provider, ticket]);

  if (error) {
    const message = happyMConnectErrorMessage(
      error,
      provider || '',
      typeof navigator === 'undefined' ? 'en' : navigator.language
    );
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-newBgColor p-8 text-textColor">
        <div className="max-w-lg text-center" role="alert">
          <p>{message}</p>
          <button
            className="mt-6 rounded bg-primary px-5 py-2 text-white"
            type="button"
            onClick={() => window.close()}
          >
            {typeof navigator !== 'undefined' &&
            navigator.language.toLowerCase().startsWith('it')
              ? 'Chiudi'
              : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-newBgColor text-textColor">
      Connessione Social Manager in corso…
    </div>
  );
};
