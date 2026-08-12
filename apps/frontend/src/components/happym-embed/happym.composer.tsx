'use client';

import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { StandaloneModal } from '@gitroom/frontend/components/standalone-modal/standalone.modal';
import { AppLayout } from '@gitroom/frontend/components/launches/layout.standalone';
import { canMountHappyMComposerShell } from './happym.composer.bootstrap';
import i18next from '@gitroom/react/translation/i18next';
import {
  appendHappyMComposerPreferences,
  persistHappyMComposerPreferences,
  resolveHappyMComposerPreferences,
} from './happym.composer.preferences';

type EmbedSession = {
  active: boolean;
  origin: string;
  tenantId: string;
  pharmacyId: string;
  correlationId: string;
  expiresAt: string;
  purpose: 'composer' | 'connect';
};

type EmbedEnvelope = {
  source: 'happym-postiz';
  version: '1.0';
  type: string;
  correlationId: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export const HappyMComposer: FC = () => {
  const fetch = useFetch();
  const searchParams = useSearchParams();
  const ticket = searchParams.get('ticket');
  const lang = searchParams.get('lang');
  const lng = searchParams.get('lng');
  const theme = searchParams.get('theme');
  const mode = searchParams.get('mode');
  const [session, setSession] = useState<EmbedSession>();
  const [error, setError] = useState('');
  const readySent = useRef(false);

  const emit = useCallback(
    (type: string, payload: Record<string, unknown> = {}) => {
      if (!session?.origin) {
        return;
      }
      const envelope: EmbedEnvelope = {
        source: 'happym-postiz',
        version: '1.0',
        type,
        correlationId: session.correlationId,
        timestamp: new Date().toISOString(),
        payload,
      };
      window.parent.postMessage(envelope, session.origin);
    },
    [session]
  );

  useEffect(() => {
    const initialize = async () => {
      try {
        const preferences = resolveHappyMComposerPreferences(
          lang || lng || window.localStorage.getItem('i18nextLng'),
          null,
          theme || mode || window.localStorage.getItem('happym_embed_theme'),
          null
        );
        persistHappyMComposerPreferences(preferences);
        await i18next.changeLanguage(preferences.language);

        if (ticket) {
          const response = await fetch('/happym/embed-sessions/exchange', {
            method: 'POST',
            body: JSON.stringify({ ticket }),
          });
          if (!response.ok) {
            throw new Error(`Ticket exchange failed (${response.status})`);
          }
          const result = await response.json();
          window.location.replace(
            appendHappyMComposerPreferences(result.redirectUrl, preferences)
          );
          return;
        }

        const response = await fetch('/happym/embed-sessions/current');
        if (!response.ok) {
          throw new Error(`Session validation failed (${response.status})`);
        }
        const current = (await response.json()) as EmbedSession;
        if (!current.active || current.purpose !== 'composer') {
          throw new Error('No active HappyM embed session');
        }
        setSession(current);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Embed initialization failed'
        );
      }
    };
    initialize();
  }, [fetch, lang, lng, mode, theme, ticket]);

  useEffect(() => {
    if (!session || readySent.current) {
      return;
    }
    readySent.current = true;
    emit('embed.ready', {
      tenantId: session.tenantId,
      pharmacyId: session.pharmacyId,
      expiresAt: session.expiresAt,
    });
  }, [session, emit]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== session.origin) {
        return;
      }
      const message = event.data as Partial<EmbedEnvelope> | undefined;
      if (
        message?.source !== 'happym-postiz' ||
        message.version !== '1.0' ||
        typeof message.type !== 'string'
      ) {
        return;
      }

      if (message.type === 'theme.changed' || message.type === 'embed.init') {
        const nextPreferences = resolveHappyMComposerPreferences(
          typeof message.payload?.lang === 'string'
            ? message.payload.lang
            : typeof message.payload?.lng === 'string'
            ? message.payload.lng
            : i18next.language,
          null,
          typeof message.payload?.theme === 'string'
            ? message.payload.theme
            : typeof message.payload?.mode === 'string'
            ? message.payload.mode
            : document.documentElement.classList.contains('dark')
            ? 'dark'
            : 'light',
          null
        );
        persistHappyMComposerPreferences(nextPreferences);
        void i18next.changeLanguage(nextPreferences.language);
      }
      if (message.type === 'composer.close') {
        emit('embed.closeRequested');
      }
      if (message.type === 'composer.reloadIntegrations') {
        window.location.reload();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [session, emit]);

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-newBgColor p-8 text-textColor">
        <div role="alert">{error}</div>
      </div>
    );
  }
  if (!canMountHappyMComposerShell(ticket, session)) {
    return null;
  }

  return (
    <AppLayout userPath="/happym/embed-sessions/user">
      <div className="h-screen w-screen overflow-hidden bg-black">
        <div className="text-textColor h-[calc(100vh+80px)] w-[calc(100vw+80px)] -m-[40px]">
          <StandaloneModal
            onClose={() => emit('embed.closeRequested')}
            onSaved={(posts, type, integrations) => {
              const eventType =
                type === 'draft'
                  ? 'post.draftSaved'
                  : type === 'schedule'
                  ? 'post.scheduled'
                  : 'post.created';
              for (const post of posts) {
                const integration = integrations.find(
                  (item) => item.id === post.integration
                );
                emit(eventType, {
                  tenantId: session.tenantId,
                  pharmacyId: session.pharmacyId,
                  postizPostId: post.postId,
                  integrationId: post.integration,
                  provider: integration?.identifier,
                  status: type,
                });
              }
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
};
