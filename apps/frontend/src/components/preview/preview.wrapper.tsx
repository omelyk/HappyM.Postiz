'use client';

import useSWR from 'swr';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { ReactNode, useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { CopilotKit } from '@copilotkit/react-core';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
export const PreviewWrapper = ({
  children,
  userPath = '/user/self',
  fillViewport = false,
}: {
  children: ReactNode;
  userPath?: string;
  fillViewport?: boolean;
}) => {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user } = useSWR(userPath, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });
  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        showDevConsole={false}
      >
        <MantineWrapper fillViewport={fillViewport}>
          <Toaster />
          <ToolTip />
          <div
            className={
              fillViewport
                ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden'
                : undefined
            }
          >
            {children}
          </div>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
