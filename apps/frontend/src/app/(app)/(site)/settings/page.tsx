import { SettingsPopup } from '@gitroom/frontend/components/layout/settings.component';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import Link from 'next/link';

const applianceMode = process.env.HAPPYM_APPLIANCE_MODE === 'true';
export const metadata: Metadata = {
  title: applianceMode
    ? 'Social Manager Settings'
    : `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Settings`,
  description: '',
};

const SocialManagerApplianceSettings = () => (
  <main
    className="flex flex-1 flex-col overflow-y-auto bg-newBgColorInner p-[24px] text-newTextColor"
    data-testid="social-manager-appliance-settings"
  >
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-[24px]">
      <header className="flex flex-col gap-[8px]">
        <h1 className="text-[26px] font-[700]">Social Manager</h1>
        <p className="max-w-[720px] text-textItemBlur">
          Console amministrativa pronta. Le impostazioni del motore e delle app
          social vengono gestite in sicurezza dal CRM.
        </p>
      </header>

      <section className="grid gap-[16px] md:grid-cols-2">
        <div className="rounded-[12px] border border-customColor6 bg-newBgColor p-[20px]">
          <h2 className="text-[18px] font-[600]">Configurazione</h2>
          <p className="mt-[8px] text-textItemBlur">
            La configurazione di prodotto è amministrata centralmente. I dati
            riservati non vengono mostrati in questa console.
          </p>
        </div>
        <div className="rounded-[12px] border border-customColor6 bg-newBgColor p-[20px]">
          <h2 className="text-[18px] font-[600]">Stato operativo</h2>
          <p className="mt-[8px] text-textItemBlur">
            La sessione amministrativa è attiva. Puoi controllare contenuti,
            canali e attività dalle sezioni della barra laterale.
          </p>
        </div>
      </section>

      <nav className="flex flex-wrap gap-[12px]" aria-label="Azioni rapide">
        <Link
          className="rounded-[8px] bg-primary px-[18px] py-[10px] text-white"
          href="/media"
        >
          Apri Media
        </Link>
        <Link
          className="rounded-[8px] border border-customColor6 px-[18px] py-[10px]"
          href="/third-party"
        >
          Gestisci integrazioni
        </Link>
        <Link
          className="rounded-[8px] border border-customColor6 px-[18px] py-[10px]"
          href="/analytics"
        >
          Apri Analytics
        </Link>
      </nav>
    </div>
  </main>
);

export default function Index() {
  if (applianceMode) {
    return <SocialManagerApplianceSettings />;
  }
  return <SettingsPopup />;
}
