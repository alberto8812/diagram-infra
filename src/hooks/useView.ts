import { useCallback } from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useSceneStore } from 'src/stores/sceneStore';
import { useModelStore } from 'src/stores/modelStore';
import * as reducers from 'src/stores/reducers';
import { Model, View } from 'src/types';
import { INITIAL_SCENE_STATE } from 'src/config';
import { generateId } from 'src/utils';

export const useView = () => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  const sceneActions = useSceneStore((state) => {
    return state.actions;
  });

  const modelActions = useModelStore((state) => {
    return state.actions;
  });

  const changeView = useCallback(
    (viewId: string, model: Model) => {
      const newState = reducers.view({
        action: 'SYNC_SCENE',
        payload: undefined,
        ctx: { viewId, state: { model, scene: INITIAL_SCENE_STATE } }
      });

      sceneActions.set(newState.scene);
      uiStateActions.setView(viewId);
    },
    [uiStateActions, sceneActions]
  );

  // Creates a new (empty) view on `model` and switches to it, mirroring how
  // useInitialDataManager creates the default view when a loaded model has
  // none: reducers.view CREATE_VIEW, persist the resulting model, then
  // SYNC_SCENE/switch via changeView. Returns the new view's id.
  const createView = useCallback(
    (newView: Partial<View>, model: Model): string => {
      const viewId = generateId();

      const newState = reducers.view({
        action: 'CREATE_VIEW',
        payload: newView,
        ctx: { viewId, state: { model, scene: INITIAL_SCENE_STATE } }
      });

      modelActions.set(newState.model);
      changeView(viewId, newState.model);

      return viewId;
    },
    [modelActions, changeView]
  );

  return {
    changeView,
    createView
  };
};
