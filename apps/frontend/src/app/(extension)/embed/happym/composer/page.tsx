import { Suspense } from 'react';
import { HappyMComposer } from '@gitroom/frontend/components/happym-embed/happym.composer';

export default function HappyMComposerPage() {
  return (
    <Suspense fallback={null}>
      <HappyMComposer />
    </Suspense>
  );
}
