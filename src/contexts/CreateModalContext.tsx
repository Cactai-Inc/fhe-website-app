import { createContext, useContext } from 'react';
import type { CreateModalStep } from '../components/app/CreateModal';

export interface CreateModalTriggerApi {
  openCreate: (step: CreateModalStep) => void;
}

export const CreateModalTriggerContext = createContext<CreateModalTriggerApi | null>(null);

/**
 * Lets a page's own PLUSPASS "+" control open the ONE CreateModal instance
 * (mounted once in AppLayout, next to the header's admin/staff "+" tab) at a
 * specific step — e.g. jumping straight to post-type selection instead of the
 * generic destination menu. Only available under AppLayout's Outlet; returns
 * null elsewhere (callers should hide their button rather than call it).
 */
export function useCreateModalTrigger(): CreateModalTriggerApi | null {
  return useContext(CreateModalTriggerContext);
}
