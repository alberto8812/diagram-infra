import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const getInitialValue = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;

  return window.matchMedia(QUERY).matches;
};

// Mirrors the `@media (prefers-reduced-motion: reduce)` CSS query used
// elsewhere (e.g. Connector.tsx's dash-offset flow animation) for the cases
// where the branching has to happen in JS instead of CSS — e.g.
// ConnectorPacket.tsx skipping its travel tween entirely rather than just
// disabling a CSS animation.
export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(getInitialValue);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQueryList = window.matchMedia(QUERY);

    const onChange = () => {
      setReducedMotion(mediaQueryList.matches);
    };

    mediaQueryList.addEventListener('change', onChange);

    return () => {
      mediaQueryList.removeEventListener('change', onChange);
    };
  }, []);

  return reducedMotion;
};
