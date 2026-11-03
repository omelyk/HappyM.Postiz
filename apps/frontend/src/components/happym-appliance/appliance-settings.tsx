'use client';

import { ReactNode } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { SettingsPopup } from '@gitroom/frontend/components/layout/settings.component';
import { isApplianceAdministrator } from './happym.appliance.navigation';

export const ApplianceSettings = ({ children }: { children: ReactNode }) => {
  const user = useUser();

  if (!isApplianceAdministrator(user)) return <>{children}</>;

  // Reuse the original settings and its existing subscription/feature gates.
  // Ordinary members retain the existing CRM-managed appliance landing.
  return (
    <section
      className="social-manager-settings flex min-h-0 min-w-0 flex-1 overflow-auto"
      data-testid="social-manager-original-administration"
    >
      <SettingsPopup />
    </section>
  );
};
