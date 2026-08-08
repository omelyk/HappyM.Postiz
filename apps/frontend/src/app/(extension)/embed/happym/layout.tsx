import { ReactNode } from 'react';
import { AppLayout } from '@gitroom/frontend/components/launches/layout.standalone';

export default function HappyMEmbedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AppLayout userPath="/happym/embed-sessions/user">{children}</AppLayout>
  );
}
