'use client';

import { ReactNode, useMemo } from 'react';
import { PreviewWrapper } from '@gitroom/frontend/components/preview/preview.wrapper';
import { usePathname } from 'next/navigation';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
export const AppLayout = ({
  children,
  userPath,
}: {
  children: ReactNode;
  userPath?: string;
}) => {
  const params = usePathname();
  const style = useMemo(() => {
    const all = params.split('/');
    all.pop();
    return all.pop();
  }, [params]);
  return (
    <div
      className={`hideCopilot ${style} h-[100vh] min-h-0 w-full min-w-0 overflow-hidden text-textColor flex flex-1 flex-col !bg-none`}
    >
      <style>
        {`
          #add-edit-modal, .hideCopilot {
            background: transparent !important;
          }
          html, body, body > div {
            height: 100% !important;
            min-height: 100% !important;
          }
          html body.dark, html {
            background: transparent !important;
          }
        `}
      </style>
      <PreviewWrapper userPath={userPath} fillViewport>
        {children}
      </PreviewWrapper>
    </div>
  );
};
