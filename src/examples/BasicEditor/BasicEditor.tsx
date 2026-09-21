import React, { useEffect, useMemo, useState } from 'react';
import Isoflow, { Model, InitialData } from 'src/Isoflow';
import { initialData, icons } from '../initialData';
import { saveDiagram, loadDiagram, debounce } from '../persistence';

const SAVE_DEBOUNCE_MS = 500;

export const BasicEditor = () => {
  const [restored, setRestored] = useState<InitialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadDiagram(icons).then((data) => {
      if (cancelled) return;

      setRestored(data);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // onModelUpdated fires on every model change, including each frame of a drag,
  // so the write is debounced rather than issued per event.
  const onModelUpdated = useMemo(() => {
    return debounce((model: Model) => {
      saveDiagram(model);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Mounting Isoflow before the restore resolves would seed it with the example
  // and immediately overwrite the saved diagram.
  if (isLoading) return null;

  return (
    <Isoflow
      initialData={restored ?? { ...initialData, fitToView: true }}
      onModelUpdated={onModelUpdated}
    />
  );
};
