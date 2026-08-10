'use client';

import { useUser } from '@gitroom/frontend/components/layout/user.context';

export const HappyMSystemWorkspaceNotice = () => {
  const user = useUser();
  const applianceMode = process.env.NEXT_PUBLIC_HAPPYM_APPLIANCE_MODE === 'true';
  const systemOrganizationId =
    process.env.NEXT_PUBLIC_HAPPYM_APPLIANCE_SYSTEM_ORGANIZATION_ID || 'happym-system';

  if (!applianceMode || user?.orgId !== systemOrganizationId) return null;

  const openWorkspaceSelector = () => {
    const selector = document.getElementById('workspace-selector');
    selector?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (selector?.querySelector('[aria-label="Workspace farmacia"]') as HTMLElement)?.focus();
  };

  return (
    <section className="m-[16px] rounded-[12px] border border-orange-400/40 bg-orange-400/10 p-[18px] text-newTextColor" data-testid="system-workspace-empty-state">
      <h2 className="text-[18px] font-semibold">Workspace di sistema</h2>
      <p className="mt-[6px] text-textItemBlur">
        Nessun canale è mostrato nel workspace di sistema. Seleziona il workspace
        della farmacia per vedere e gestire esclusivamente le sue integrazioni.
      </p>
      <button type="button" onClick={openWorkspaceSelector} className="mt-[12px] rounded-[8px] bg-primary px-[14px] py-[8px] text-white">
        Seleziona workspace farmacia
      </button>
    </section>
  );
};
