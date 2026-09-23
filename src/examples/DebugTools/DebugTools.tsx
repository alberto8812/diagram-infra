import React from 'react';
import Isoflow from 'src/Isoflow';
import { useCurrentDiagram } from '../useCurrentDiagram';

export const DebugTools = () => {
  const { initialData, isLoading } = useCurrentDiagram();

  // Mounting Isoflow before the load resolves would seed it with the example
  // and immediately overwrite the saved diagram (see BasicEditor.tsx).
  if (isLoading) return null;

  return <Isoflow initialData={initialData} enableDebugTools height="100%" />;
};
