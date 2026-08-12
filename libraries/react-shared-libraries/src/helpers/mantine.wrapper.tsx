'use client';

import { ReactNode } from 'react';
import {
  DecisionEverywhere,
  ModalManager,
} from '@gitroom/frontend/components/layout/new-modal';
export const MantineWrapper = (props: {
  children: ReactNode;
  fillViewport?: boolean;
}) => {
  return (
    <ModalManager fillViewport={props.fillViewport}>
      <DecisionEverywhere />
      {props.children}
    </ModalManager>
  );
};
