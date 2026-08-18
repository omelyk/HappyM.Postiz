export const HAPPYM_OPEN_WORKSPACE_SELECTOR =
  'happym:open-workspace-selector' as const;

export const requestHappyMWorkspaceSelector = (target: EventTarget) => {
  target.dispatchEvent(new Event(HAPPYM_OPEN_WORKSPACE_SELECTOR));
};

export const happyMWorkspaceKind = (
  organizationId: string,
  systemOrganizationId: string
) => (organizationId === systemOrganizationId ? 'system' : 'pharmacy');
