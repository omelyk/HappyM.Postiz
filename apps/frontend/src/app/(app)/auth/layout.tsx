export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { TestimonialComponent } from '@gitroom/frontend/components/auth/testimonial.component';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { SOCIAL_MANAGER_RELEASE } from '@gitroom/helpers/social-manager/release';
import styles from '@gitroom/frontend/components/happym-appliance/appliance-login.module.css';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const applianceMode = process.env.HAPPYM_APPLIANCE_MODE === 'true';
  const productName = process.env.HAPPYM_PRODUCT_NAME || 'Social Manager';
  const year = new Date().getFullYear();

  if (applianceMode) {
    const customerName = process.env.HAPPYM_APPLIANCE_CUSTOMER_NAME?.trim();
    const configuredLogo = process.env.HAPPYM_APPLIANCE_CUSTOMER_LOGO_URL || '';
    const customerLogo = /^\/brand\/[a-zA-Z0-9_-]+\.png$/.test(configuredLogo) ? configuredLogo : null;
    return (
      <div className={styles.page}>
        <ReturnUrlComponent />
        <header className={styles.header}>
          <span className={styles.headerTitle}>Appliance Editoriale</span>
          <span className={styles.version} aria-label={`Versione interna ${SOCIAL_MANAGER_RELEASE.version}, versione base ${SOCIAL_MANAGER_RELEASE.baseVersion}`}>
            Versione {SOCIAL_MANAGER_RELEASE.version}<span className={styles.separator}>:.:</span>{SOCIAL_MANAGER_RELEASE.baseVersion}
          </span>
        </header>
        <main className={styles.main}>
          <img src="/brand/netforges-wordmark.png" alt="NetForges" width={616} height={99} className={styles.netforges} />
          <section className={styles.card} aria-label="Social Manager — accesso all’appliance">
            <img src="/brand/social-manager-logo.png" alt="Social Manager" width={360} height={80} className={styles.productLogo} />
            {customerName && <div className={styles.customer}>
              {customerLogo && <img src={customerLogo} alt={`Logo ${customerName}`} width={180} height={48} />}
              <div className={styles.customerText}><span>Installazione riservata a</span><strong>{customerName}</strong></div>
            </div>}
            {children}
          </section>
        </main>
        <footer className={styles.footer}>
          © {year} NetForges · Social Manager<br />
          <a href="https://github.com/omelyk/HappyM.Postiz" target="_blank" rel="noopener noreferrer">Codice sorgente e licenza AGPL-3.0</a>
        </footer>
      </div>
    );
  }

  return (
    <div className="bg-[#0E0E0E] flex flex-1 p-[12px] gap-[12px] min-h-screen w-screen text-white">
      {/*<style>{`html, body {overflow-x: hidden;}`}</style>*/}
      <ReturnUrlComponent />
      <div className="flex flex-col py-[40px] px-[20px] flex-1 lg:w-[600px] lg:flex-none rounded-[12px] text-white p-[12px] bg-[#1A1919]">
        <div className="w-full max-w-[440px] mx-auto gap-[20px] min-h-full flex flex-1 flex-col text-white">
          <div className="flex flex-1 flex-col justify-center gap-[20px]">
            {applianceMode ? (
              <img
                src="/brand/social-manager-logo-white.png"
                alt={`${productName} — NetForges`}
                title={productName}
                width={360}
                height={80}
                className="h-auto w-full max-w-[360px]"
              />
            ) : (
              <LogoTextComponent />
            )}
            <div className="flex">{children}</div>
          </div>
          {applianceMode && (
            <footer className="mt-auto border-t border-white/10 pt-5 text-center text-xs text-gray-400">
              <a
                href="https://www.netforges.it"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-gray-300 hover:text-white"
                aria-label="NetForges — apre il sito in una nuova scheda"
              >
                <img
                  src="/brand/netforges-icon.png"
                  alt="NetForges"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
                <span>{productName} — appliance NetForges</span>
              </a>
              <p className="mt-2">
                © {year} NetForges — tutti i diritti riservati
              </p>
            </footer>
          )}
        </div>
      </div>
      {!applianceMode && (
        <div className="text-[36px] flex-1 pt-[88px] hidden lg:flex flex-col items-center">
          <div className="text-center">
            Over <span className="text-[42px] text-[#FC69FF]">20,000+</span>{' '}
            Entrepreneurs use
            <br />
            Postiz To Grow Their Social Presence
          </div>
          <TestimonialComponent />
        </div>
      )}
    </div>
  );
}
