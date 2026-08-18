export const dynamic = 'force-dynamic';
import { LaunchesComponent } from '@gitroom/frontend/components/launches/launches.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { happyMPageTitle, isHappyMApplianceMode } from '@gitroom/frontend/components/happym-appliance/happym.appliance.branding';
export const metadata: Metadata = {
  title: isHappyMApplianceMode() ? happyMPageTitle('Calendario') : `${isGeneralServerSide() ? 'Postiz Calendar' : 'Gitroom Launches'}`,
  description: '',
};
export default async function Index() {
  return <LaunchesComponent />;
}
