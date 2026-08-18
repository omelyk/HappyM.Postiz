'use client';

import { FC, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export const HappyMWorkspace: FC = () => {
  const fetch = useFetch();
  const ticket = useSearchParams().get('ticket');
  const [error, setError] = useState('');

  useEffect(() => {
    const initialize = async () => {
      try {
        if (!ticket) {
          throw new Error('Workspace ticket is missing');
        }
        const response = await fetch('/happym/embed-sessions/exchange', {
          method: 'POST',
          body: JSON.stringify({ ticket, purpose: 'workspace' }),
        });
        if (!response.ok) {
          throw new Error(
            `Workspace ticket exchange failed (${response.status})`
          );
        }
        const result = (await response.json()) as { redirectUrl?: string };
        if (!['/launches', '/media'].includes(result.redirectUrl || '')) {
          throw new Error('Workspace landing path is invalid');
        }
        window.location.replace(result.redirectUrl!);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Workspace initialization failed'
        );
      }
    };
    initialize();
  }, [fetch, ticket]);

  if (!error) {
    return null;
  }
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-newBgColor p-8 text-textColor">
      <div role="alert">{error}</div>
    </div>
  );
};
