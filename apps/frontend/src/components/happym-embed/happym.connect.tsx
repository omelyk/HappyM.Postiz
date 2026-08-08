'use client';

import { FC, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

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
  const [error, setError] = useState('');

  useEffect(() => {
    const initialize = async () => {
      try {
        if (!provider || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(provider)) {
          throw new Error('Invalid Social Manager provider');
        }

        if (ticket) {
          const exchange = await fetch('/happym/embed-sessions/exchange', {
            method: 'POST',
            body: JSON.stringify({ ticket, purpose: 'connect', provider }),
          });
          if (!exchange.ok) {
            throw new Error(
              `Connect ticket exchange failed (${exchange.status})`
            );
          }
          const result = await exchange.json();
          window.location.replace(result.redirectUrl);
          return;
        }

        const currentResponse = await fetch('/happym/embed-sessions/current');
        if (!currentResponse.ok) {
          throw new Error(
            `Connect session validation failed (${currentResponse.status})`
          );
        }
        const current = (await currentResponse.json()) as ConnectSession;
        if (
          !current.active ||
          current.purpose !== 'connect' ||
          current.provider !== provider
        ) {
          throw new Error('No active Social Manager connect session');
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
          throw new Error(
            `Provider connect initialization failed (${connectResponse.status})`
          );
        }
        const connect = (await connectResponse.json()) as {
          url?: string;
          err?: boolean;
        };
        if (!connect.url || connect.err) {
          throw new Error('Provider connect initialization failed');
        }
        window.location.replace(connect.url);
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : 'Social Manager connect failed'
        );
      }
    };

    initialize();
  }, [fetch, provider, ticket]);

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-newBgColor p-8 text-textColor">
        <div role="alert">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-newBgColor text-textColor">
      Connessione Social Manager in corso…
    </div>
  );
};
