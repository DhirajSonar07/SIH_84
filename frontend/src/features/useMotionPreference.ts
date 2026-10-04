import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';
function subscribe(onChange: () => void) {
  const preference = window.matchMedia(query);
  preference.addEventListener('change', onChange);
  return () => preference.removeEventListener('change', onChange);
}
const getSnapshot = () => window.matchMedia(query).matches;
const getServerSnapshot = () => true;

export default function useMotionPreference() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
