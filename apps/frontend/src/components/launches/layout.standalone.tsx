'use client';

import { ReactNode, useEffect, useMemo } from 'react';
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
  useEffect(() => {
    document.body.classList.add('happym-embed-active');
    return () => document.body.classList.remove('happym-embed-active');
  }, []);
  return (
    <div
      className={`hideCopilot ${style} h-full min-h-0 w-full min-w-0 overflow-hidden text-textColor flex flex-1 flex-col !bg-none`}
    >
      <style>
        {`
          .hideCopilot {
            background: transparent !important;
          }
          body.happym-embed-active #add-edit-modal,
          body.happym-embed-active [data-happym-modal-backdrop] {
            background: rgba(0, 0, 0, 0.55) !important;
          }
          body.happym-embed-active [role="dialog"],
          body.happym-embed-active .mantine-Modal-content,
          body.happym-embed-active .mantine-Drawer-content,
          body.happym-embed-active .mantine-Popover-dropdown {
            background: var(--new-bgColorInner) !important;
            color: rgb(var(--new-textColor)) !important;
            opacity: 1 !important;
          }
          html, body, body > div {
            height: 100% !important;
            min-height: 100% !important;
          }
          html, body {
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
