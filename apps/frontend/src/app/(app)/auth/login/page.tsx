export const dynamic = 'force-dynamic';
import { Login } from '@gitroom/frontend/components/auth/login';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { happyMPageTitle, isHappyMApplianceMode } from '@gitroom/frontend/components/happym-appliance/happym.appliance.branding';
export const metadata: Metadata = {
  title: isHappyMApplianceMode()
    ? happyMPageTitle('Login')
    : `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Login`,
  description: '',
};
export default async function Auth() {
  return <Login />;
}
