import React from 'react';
import Isoflow from 'src/Isoflow';
import { useCurrentDiagram } from '../useCurrentDiagram';

export const ReadonlyMode = () => {
  const { initialData, isLoading } = useCurrentDiagram();

  // Waiting avoids showing the bundled example for a frame before the real
  // diagram replaces it. This mode never saves, so unlike BasicEditor there
  // is nothing here that an early mount could overwrite.
  if (isLoading) return null;

  return <Isoflow initialData={initialData} editorMode="EXPLORABLE_READONLY" />;
};
