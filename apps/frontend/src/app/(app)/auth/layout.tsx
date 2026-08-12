export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { TestimonialComponent } from '@gitroom/frontend/components/auth/testimonial.component';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const applianceMode = process.env.HAPPYM_APPLIANCE_MODE === 'true';
  const productName = process.env.HAPPYM_PRODUCT_NAME || 'Social Manager';
  const year = new Date().getFullYear();

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
