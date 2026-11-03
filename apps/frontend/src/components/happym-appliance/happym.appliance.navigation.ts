export const happyMApplianceHomePath = (
  applianceMode: boolean,
  isGeneral: boolean
) => (applianceMode ? '/settings' : isGeneral ? '/launches' : '/analytics');

// Presentation only: these values come from authenticated /user/self. The
// backend re-resolves the user and organization membership from the database;
// this does not grant a role, an entitlement or access to another organization.
export const isApplianceAdministrator = (
  user?: {
    isSuperAdmin?: boolean;
    role?: string;
    orgId?: string;
  } | null
) =>
  user?.isSuperAdmin === true &&
  user.role === 'SUPERADMIN' &&
  typeof user.orgId === 'string' &&
  user.orgId.length > 0;

export const shouldCloseLaunchesPopup = (
  hasOpener: boolean,
  message: string | null,
  channelAdded: string | null
) => hasOpener && (!!message || !!channelAdded);
