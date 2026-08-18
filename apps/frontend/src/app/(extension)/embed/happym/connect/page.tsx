import { Suspense } from 'react';
import { HappyMConnect } from '@gitroom/frontend/components/happym-embed/happym.connect';

export default function HappyMConnectPage() {
  return (
    <Suspense fallback={null}>
      <HappyMConnect />
    </Suspense>
  );
}
