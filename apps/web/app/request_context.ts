import { createContext } from 'react-router';

/** Carries server-only request values shared by the loader and document renderer. */
export const waitRequestContext = createContext<{
  nonce: string;
  loadWaits: () => Promise<Response>;
}>();
