'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  HAPPYM_OPEN_WORKSPACE_SELECTOR,
  happyMWorkspaceKind,
} from '@gitroom/frontend/components/happym-appliance/happym.workspace-selector';
export const OrganizationSelector: FC<{ asOpenSelect?: boolean }> = ({
  asOpenSelect,
}) => {
  const fetch = useFetch();
  const t = useT();
  const user = useUser();
  const [isOpen, setIsOpen] = useState(!!asOpenSelect);
  const applianceMode =
    process.env.NEXT_PUBLIC_HAPPYM_APPLIANCE_MODE === 'true';
  const systemOrganizationId =
    process.env.NEXT_PUBLIC_HAPPYM_APPLIANCE_SYSTEM_ORGANIZATION_ID ||
    'happym-system';
  const load = useCallback(async () => {
    return await (await fetch('/user/organizations')).json();
  }, []);
  const { isLoading, data } = useSWR('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });
  const current = useMemo(() => {
    return data?.find((d: any) => d.id === user?.orgId);
  }, [data]);
  useEffect(() => {
    if (!applianceMode || asOpenSelect) return;
    const open = () => setIsOpen(true);
    window.addEventListener(HAPPYM_OPEN_WORKSPACE_SELECTOR, open);
    return () =>
      window.removeEventListener(HAPPYM_OPEN_WORKSPACE_SELECTOR, open);
  }, [applianceMode, asOpenSelect]);
  const changeOrg = useCallback(
    (org: { name: string; id: string }) => async () => {
      await fetch('/user/change-org', {
        method: 'POST',
        body: JSON.stringify({
          id: org.id,
        }),
      });
      setIsOpen(false);
      window.location.reload();
    },
    []
  );
  if (isLoading || (!isLoading && data?.length === 1 && !applianceMode)) {
    return null;
  }
  return (
    <>
      <div className="hover:text-newTextColor" id="workspace-selector">
        <div className="group text-[12px] relative">
          {asOpenSelect && (
            <div className="bg-btnPrimary !flex !relative max-w-[500px] mx-auto py-[12px] px-[12px]">
              {applianceMode
                ? t(
                    'happym_select_pharmacy_workspace',
                    'Select pharmacy workspace'
                  )
                : 'Select Organization'}
            </div>
          )}
          {!asOpenSelect && (
            <button
              type="button"
              onClick={() => setIsOpen((value) => !value)}
              className="flex items-center gap-[8px] cursor-pointer text-start"
              aria-label={
                applianceMode
                  ? t('happym_workspace_selector_label', 'Pharmacy workspace')
                  : 'Organization'
              }
              aria-haspopup="listbox"
              aria-expanded={isOpen}
            >
              <svg
                className={
                  user?.tier.current === 'FREE'
                    ? 'animate-bounce drop-shadow-glow'
                    : ''
                }
                width="24"
                height="24"
                viewBox="0 0 26 26"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13 0.25C10.4783 0.25 8.01321 0.997774 5.91648 2.39876C3.81976 3.79975 2.18556 5.79103 1.22054 8.12079C0.255524 10.4505 0.00303191 13.0141 0.494993 15.4874C0.986955 17.9607 2.20127 20.2325 3.98439 22.0156C5.76751 23.7987 8.03935 25.0131 10.5126 25.505C12.9859 25.997 15.5495 25.7445 17.8792 24.7795C20.209 23.8144 22.2003 22.1802 23.6012 20.0835C25.0022 17.9868 25.75 15.5217 25.75 13C25.746 9.61971 24.4015 6.379 22.0112 3.98877C19.621 1.59854 16.3803 0.25397 13 0.25ZM5.93001 21.75C6.66349 20.5303 7.70003 19.5212 8.93889 18.8206C10.1777 18.12 11.5768 17.7518 13 17.7518C14.4232 17.7518 15.8223 18.12 17.0611 18.8206C18.3 19.5212 19.3365 20.5303 20.07 21.75C18.0705 23.3714 15.5743 24.2563 13 24.2563C10.4257 24.2563 7.92955 23.3714 5.93001 21.75ZM8.75001 12C8.75001 11.1594 8.99926 10.3377 9.46626 9.63883C9.93326 8.93992 10.597 8.39518 11.3736 8.07351C12.1502 7.75184 13.0047 7.66768 13.8291 7.83166C14.6536 7.99565 15.4108 8.40042 16.0052 8.9948C16.5996 9.58917 17.0044 10.3464 17.1683 11.1709C17.3323 11.9953 17.2482 12.8498 16.9265 13.6264C16.6048 14.403 16.0601 15.0668 15.3612 15.5337C14.6623 16.0007 13.8406 16.25 13 16.25C11.8728 16.25 10.7918 15.8022 9.9948 15.0052C9.19777 14.2082 8.75001 13.1272 8.75001 12ZM21.1888 20.705C20.0103 18.8727 18.2489 17.4908 16.1888 16.7825C17.216 16.0983 17.9959 15.1016 18.413 13.9399C18.8301 12.7783 18.8623 11.5132 18.5049 10.3318C18.1475 9.15035 17.4194 8.11531 16.4282 7.37968C15.4371 6.64404 14.2356 6.24686 13.0013 6.24686C11.767 6.24686 10.5654 6.64404 9.57429 7.37968C8.58316 8.11531 7.85505 9.15035 7.49762 10.3318C7.14019 11.5132 7.17241 12.7783 7.58952 13.9399C8.00662 15.1016 8.78647 16.0983 9.81376 16.7825C7.75358 17.4908 5.99217 18.8727 4.81376 20.705C3.30729 19.1064 2.30179 17.1017 1.92131 14.9382C1.54082 12.7748 1.80201 10.5474 2.67264 8.53066C3.54327 6.51396 4.98524 4.79624 6.82066 3.58946C8.65609 2.38267 10.8046 1.7396 13.0013 1.7396C15.1979 1.7396 17.3464 2.38267 19.1818 3.58946C21.0173 4.79624 22.4592 6.51396 23.3299 8.53066C24.2005 10.5474 24.4617 12.7748 24.0812 14.9382C23.7007 17.1017 22.6952 19.1064 21.1888 20.705Z"
                  fill="currentColor"
                />
              </svg>
              {applianceMode && (
                <div className="hidden max-w-[180px] flex-col leading-tight xl:flex">
                  <span className="text-[10px] uppercase tracking-wide text-textItemBlur">
                    {happyMWorkspaceKind(
                      current?.id || user?.orgId || '',
                      systemOrganizationId
                    ) === 'system'
                      ? t('happym_system_workspace_short', 'System workspace')
                      : t('happym_pharmacy_workspace_short', 'Pharmacy')}
                  </span>
                  <span className="truncate font-semibold text-newTextColor">
                    {current?.id || user?.orgId}
                  </span>
                </div>
              )}
              {!applianceMode && !!current?.name && (
                <div className="max-w-[240px] truncate">{current.name}</div>
              )}
            </button>
          )}
          {(data?.length > 1 || (applianceMode && data?.length === 1)) && (
            <div
              role="listbox"
              className={clsx(
                'hidden min-w-[320px] rounded-[8px] py-[12px] px-[12px] absolute top-[100%] end-0 z-50 bg-third border-tableBorder border gap-[8px] cursor-pointer flex-col',
                isOpen && '!flex',
                asOpenSelect
                  ? '!flex !relative max-w-[500px] mx-auto mb-[10px]'
                  : ''
              )}
            >
              {applianceMode && (
                <div className="border-b border-tableBorder pb-[8px] text-[11px] font-semibold uppercase tracking-wide text-textItemBlur">
                  {t(
                    'happym_workspace_glossary_heading',
                    'Workspace / Pharmacy'
                  )}
                </div>
              )}
              {data?.map(
                (org: {
                  name: string;
                  id: string;
                  users?: { role: 'SUPERADMIN' | 'ADMIN' | 'USER' }[];
                }) => (
                  <button
                    type="button"
                    key={org.id}
                    onClick={changeOrg(org)}
                    role="option"
                    aria-selected={org.id === user?.orgId}
                    className={clsx(
                      'rounded-[6px] px-[8px] py-[7px] text-start hover:bg-newBgLineColor',
                      org.id === user?.orgId && 'bg-newBgLineColor'
                    )}
                  >
                    {applianceMode ? (
                      <div className="flex flex-col">
                        <span className="font-semibold">{org.id}</span>
                        <span className="text-textItemBlur">
                          {org.id === systemOrganizationId
                            ? t(
                                'happym_system_workspace_option',
                                'System · engine administration'
                              )
                            : org.name ||
                              t(
                                'happym_pharmacy_workspace_short',
                                'Pharmacy workspace'
                              )}
                        </span>
                      </div>
                    ) : (
                      <>
                        {org.name}
                        {!!org.users?.[0]?.role && (
                          <span className="text-customColor18">
                            {' '}
                            (
                            {org.users[0].role === 'SUPERADMIN'
                              ? 'Super-Admin'
                              : org.users[0].role === 'ADMIN'
                              ? 'Admin'
                              : 'User'}
                            )
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )
              )}
              {applianceMode && data?.length === 1 && (
                <div className="rounded-[6px] border border-orange-400/30 bg-orange-400/10 px-[8px] py-[9px] text-textItemBlur">
                  {t(
                    'happym_workspace_not_found',
                    'Workspace not found — use Ensure workspace from the CRM.'
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {!asOpenSelect && <div className="w-[1px] h-[20px] bg-blockSeparator" />}
    </>
  );
};
