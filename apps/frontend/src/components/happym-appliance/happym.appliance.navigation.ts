export const happyMApplianceHomePath = (
  applianceMode: boolean,
  isGeneral: boolean
) => (applianceMode ? '/settings' : isGeneral ? '/launches' : '/analytics');

export const shouldCloseLaunchesPopup = (
  hasOpener: boolean,
  message: string | null,
  channelAdded: string | null
) => hasOpener && (!!message || !!channelAdded);
