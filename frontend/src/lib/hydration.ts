import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the prerendered HTML is on screen (server render and hydration), true once React
 * controls the page. Form controls stay disabled until then, so nothing typed before the
 * JavaScript has loaded is lost and no form can be submitted natively (which would put field
 * values in the URL).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
