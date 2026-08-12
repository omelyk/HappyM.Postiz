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
  const culture = searchParams.get('culture');
  const theme = searchParams.get('theme');
  const mode = searchParams.get('mode');
  const chrome = searchParams.get('chrome');
  const embedChrome = searchParams.get('embedChrome');
  const [session, setSession] = useState<EmbedSession>();
  const [hostChrome, setHostChrome] = useState(false);
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
          lang || lng || culture || window.localStorage.getItem('i18nextLng'),
          null,
          theme || mode || window.localStorage.getItem('happym_embed_theme'),
          null,
          chrome ||
            embedChrome ||
            window.localStorage.getItem('happym_embed_chrome'),
          null
        );
        persistHappyMComposerPreferences(preferences);
        setHostChrome(preferences.chrome === 'host');
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
  }, [chrome, culture, embedChrome, fetch, lang, lng, mode, theme, ticket]);

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

      if (
        message.type === 'theme.changed' ||
        message.type === 'embed.init' ||
        message.type === 'embed.hostUi'
      ) {
        const nextPreferences = resolveHappyMComposerPreferences(
          typeof message.payload?.lang === 'string'
            ? message.payload.lang
            : typeof message.payload?.lng === 'string'
            ? message.payload.lng
            : typeof message.payload?.culture === 'string'
            ? message.payload.culture
            : i18next.language,
          null,
          typeof message.payload?.theme === 'string'
            ? message.payload.theme
            : typeof message.payload?.mode === 'string'
            ? message.payload.mode
            : document.documentElement.classList.contains('dark')
            ? 'dark'
            : 'light',
          null,
          typeof message.payload?.chrome === 'string'
            ? message.payload.chrome
            : hostChrome
            ? 'host'
            : 'social-manager',
          typeof message.payload?.embedChrome === 'string'
            ? message.payload.embedChrome
            : null
        );
        persistHappyMComposerPreferences(nextPreferences);
        setHostChrome(nextPreferences.chrome === 'host');
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
  }, [session, emit, hostChrome]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-newBgColor p-8 text-textColor">
        <div role="alert">{error}</div>
      </div>
    );
  }
  if (!canMountHappyMComposerShell(ticket, session)) {
    return null;
  }

  return (
    <AppLayout userPath="/happym/embed-sessions/user">
      <div className="h-full w-full min-w-0 overflow-hidden bg-newBgColor text-textColor">
        <div className="h-full w-full min-w-0 overflow-hidden">
          <StandaloneModal
            hostChrome={hostChrome}
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
