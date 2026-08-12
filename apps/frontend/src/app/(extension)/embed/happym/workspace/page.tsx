import { Suspense } from 'react';
import { HappyMWorkspace } from '@gitroom/frontend/components/happym-embed/happym.workspace';

export default function HappyMWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <HappyMWorkspace />
    </Suspense>
  );
}
