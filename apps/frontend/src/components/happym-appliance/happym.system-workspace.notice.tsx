'use client';

import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { requestHappyMWorkspaceSelector } from './happym.workspace-selector';

export const HappyMSystemWorkspaceNotice = () => {
  const user = useUser();
  const t = useT();
  const applianceMode =
    process.env.NEXT_PUBLIC_HAPPYM_APPLIANCE_MODE === 'true';
  const systemOrganizationId =
    process.env.NEXT_PUBLIC_HAPPYM_APPLIANCE_SYSTEM_ORGANIZATION_ID ||
    'happym-system';

  if (!applianceMode || user?.orgId !== systemOrganizationId) return null;

  const openWorkspaceSelector = () => {
    requestHappyMWorkspaceSelector(window);
  };

  return (
    <section
      className="m-[16px] rounded-[12px] border border-orange-400/40 bg-orange-400/10 p-[18px] text-newTextColor"
      data-testid="system-workspace-empty-state"
    >
      <h2 className="text-[18px] font-semibold">
        {t('happym_system_workspace_title', 'System workspace')}
      </h2>
      <p className="mt-[6px] text-textItemBlur">
        {t(
          'happym_system_workspace_description',
          'No channels are shown in the System workspace. Select a pharmacy workspace to view and manage only its integrations.'
        )}
      </p>
      <button
        type="button"
        onClick={openWorkspaceSelector}
        className="mt-[12px] rounded-[8px] bg-primary px-[14px] py-[8px] text-white"
      >
        {t('happym_select_pharmacy_workspace', 'Select pharmacy workspace')}
      </button>
    </section>
  );
};
