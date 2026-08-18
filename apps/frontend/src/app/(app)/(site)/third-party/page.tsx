import { ThirdPartyComponent } from '@gitroom/frontend/components/third-parties/third-party.component';

export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { happyMPageTitle, isHappyMApplianceMode } from '@gitroom/frontend/components/happym-appliance/happym.appliance.branding';
export const metadata: Metadata = {
  title: isHappyMApplianceMode()
    ? happyMPageTitle('Integrazioni')
    : `${isGeneralServerSide() ? 'Postiz Integrations' : 'Gitroom Integrations'}`,
  description: '',
};
export default async function Index() {
  return <ThirdPartyComponent />;
}
