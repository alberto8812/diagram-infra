import { useMemo } from 'react';
import { Flow } from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { getItemByIdOrThrow } from 'src/utils';

export const useFlow = (id: string): Flow => {
  const flows = useModelStore((state) => {
    return state.flows ?? [];
  });

  const flow = useMemo(() => {
    return getItemByIdOrThrow(flows, id).value;
  }, [flows, id]);

  return flow;
};
