import { MediaLayoutComponent } from '@gitroom/frontend/components/new-layout/layout.media.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { happyMPageTitle, isHappyMApplianceMode } from '@gitroom/frontend/components/happym-appliance/happym.appliance.branding';

export const metadata: Metadata = {
  title: isHappyMApplianceMode() ? happyMPageTitle('Media') : `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Media`,
  description: '',
};

export default async function Page() {
  return <MediaLayoutComponent />
}
