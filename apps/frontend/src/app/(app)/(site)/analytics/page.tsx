export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { PlatformAnalytics } from '@gitroom/frontend/components/platform-analytics/platform.analytics';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { happyMPageTitle, isHappyMApplianceMode } from '@gitroom/frontend/components/happym-appliance/happym.appliance.branding';
export const metadata: Metadata = {
  title: isHappyMApplianceMode() ? happyMPageTitle('Analytics') : `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Analytics`,
  description: '',
};
export default async function Index() {
  return <PlatformAnalytics />;
}
