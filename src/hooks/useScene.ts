import { useCallback, useMemo } from 'react';
import {
  ModelItem,
  ViewItem,
  Connector,
  TextBox,
  Rectangle,
  ItemReference,
  LayerOrderingAction,
  Flow,
  FlowStep
} from 'src/types';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { useSceneStore } from 'src/stores/sceneStore';
import * as reducers from 'src/stores/reducers';
import type { State } from 'src/stores/reducers/types';
import { getItemByIdOrThrow } from 'src/utils';
import {
  CONNECTOR_DEFAULTS,
  RECTANGLE_DEFAULTS,
  TEXTBOX_DEFAULTS
} from 'src/config';

export const useScene = () => {
  const model = useModelStore((state) => {
    return state;
  });

  const scene = useSceneStore((state) => {
    return state;
  });

  const currentViewId = useUiStateStore((state) => {
    return state.view;
  });

  const currentView = useMemo(() => {
    return getItemByIdOrThrow(model.views, currentViewId).value;
  }, [currentViewId, model.views]);

  const items = useMemo(() => {
    return currentView.items ?? [];
  }, [currentView.items]);

  const colors = useMemo(() => {
    return model.colors;
  }, [model.colors]);

  const connectors = useMemo(() => {
    return (currentView.connectors ?? []).map((connector) => {
      const sceneConnector = scene.connectors[connector.id];

      return {
        ...CONNECTOR_DEFAULTS,
        ...connector,
        ...sceneConnector
      };
    });
  }, [currentView.connectors, scene.connectors]);

  const rectangles = useMemo(() => {
    return (currentView.rectangles ?? []).map((rectangle) => {
      return {
        ...RECTANGLE_DEFAULTS,
        ...rectangle
      };
    });
  }, [currentView.rectangles]);

  const textBoxes = useMemo(() => {
    return (currentView.textBoxes ?? []).map((textBox) => {
      const sceneTextBox = scene.textBoxes[textBox.id];

      return {
        ...TEXTBOX_DEFAULTS,
        ...textBox,
        ...sceneTextBox
      };
    });
  }, [currentView.textBoxes, scene.textBoxes]);

  const getState = useCallback(() => {
    return {
      model: model.actions.get(),
      scene: scene.actions.get()
    };
  }, [model.actions, scene.actions]);

  const setState = useCallback(
    (newState: State) => {
      model.actions.set(newState.model);
      scene.actions.set(newState.scene);
    },
    [model.actions, scene.actions]
  );

  const createModelItem = useCallback(
    (newModelItem: ModelItem) => {
      const newState = reducers.createModelItem(newModelItem, getState());
      setState(newState);
    },
    [getState, setState]
  );

  const updateModelItem = useCallback(
    (id: string, updates: Partial<ModelItem>) => {
      const newState = reducers.updateModelItem(id, updates, getState());
      setState(newState);
    },
    [getState, setState]
  );

  const deleteModelItem = useCallback(
    (id: string) => {
      const newState = reducers.deleteModelItem(id, getState());
      setState(newState);
    },
    [getState, setState]
  );

  const createViewItem = useCallback(
    (newViewItem: ViewItem) => {
      const newState = reducers.view({
        action: 'CREATE_VIEWITEM',
        payload: newViewItem,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const updateViewItem = useCallback(
    (id: string, updates: Partial<ViewItem>) => {
      const newState = reducers.view({
        action: 'UPDATE_VIEWITEM',
        payload: { id, ...updates },
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const deleteViewItem = useCallback(
    (id: string) => {
      const newState = reducers.view({
        action: 'DELETE_VIEWITEM',
        payload: id,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const createConnector = useCallback(
    (newConnector: Connector) => {
      const newState = reducers.view({
        action: 'CREATE_CONNECTOR',
        payload: newConnector,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const updateConnector = useCallback(
    (id: string, updates: Partial<Connector>) => {
      const newState = reducers.view({
        action: 'UPDATE_CONNECTOR',
        payload: { id, ...updates },
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const deleteConnector = useCallback(
    (id: string) => {
      const newState = reducers.view({
        action: 'DELETE_CONNECTOR',
        payload: id,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const createTextBox = useCallback(
    (newTextBox: TextBox) => {
      const newState = reducers.view({
        action: 'CREATE_TEXTBOX',
        payload: newTextBox,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const updateTextBox = useCallback(
    (id: string, updates: Partial<TextBox>) => {
      const newState = reducers.view({
        action: 'UPDATE_TEXTBOX',
        payload: { id, ...updates },
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const deleteTextBox = useCallback(
    (id: string) => {
      const newState = reducers.view({
        action: 'DELETE_TEXTBOX',
        payload: id,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const createRectangle = useCallback(
    (newRectangle: Rectangle) => {
      const newState = reducers.view({
        action: 'CREATE_RECTANGLE',
        payload: newRectangle,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const updateRectangle = useCallback(
    (id: string, updates: Partial<Rectangle>) => {
      const newState = reducers.view({
        action: 'UPDATE_RECTANGLE',
        payload: { id, ...updates },
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const deleteRectangle = useCallback(
    (id: string) => {
      const newState = reducers.view({
        action: 'DELETE_RECTANGLE',
        payload: id,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  const createFlow = useCallback(
    (newFlow: Flow) => {
      const newState = reducers.createFlow(newFlow, getState());
      setState(newState);
    },
    [getState, setState]
  );

  const updateFlow = useCallback(
    (id: string, updates: Partial<Omit<Flow, 'id' | 'steps'>>) => {
      const newState = reducers.updateFlow(id, updates, getState());
      setState(newState);
    },
    [getState, setState]
  );

  const deleteFlow = useCallback(
    (id: string) => {
      const newState = reducers.deleteFlow(id, getState());
      setState(newState);
    },
    [getState, setState]
  );

  const createFlowStep = useCallback(
    (flowId: string, step: FlowStep) => {
      const newState = reducers.createFlowStep({ flowId, step }, getState());
      setState(newState);
    },
    [getState, setState]
  );

  const updateFlowStep = useCallback(
    (
      flowId: string,
      stepId: string,
      updates: Partial<Omit<FlowStep, 'id'>>
    ) => {
      const newState = reducers.updateFlowStep(
        { flowId, stepId, updates },
        getState()
      );
      setState(newState);
    },
    [getState, setState]
  );

  const deleteFlowStep = useCallback(
    (flowId: string, stepId: string) => {
      const newState = reducers.deleteFlowStep({ flowId, stepId }, getState());
      setState(newState);
    },
    [getState, setState]
  );

  const reorderFlowSteps = useCallback(
    (flowId: string, stepId: string, toIndex: number) => {
      const newState = reducers.reorderFlowSteps(
        { flowId, stepId, toIndex },
        getState()
      );
      setState(newState);
    },
    [getState, setState]
  );

  const changeLayerOrder = useCallback(
    (action: LayerOrderingAction, item: ItemReference) => {
      const newState = reducers.view({
        action: 'CHANGE_LAYER_ORDER',
        payload: { action, item },
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId]
  );

  return {
    items,
    connectors,
    colors,
    rectangles,
    textBoxes,
    currentView,
    createModelItem,
    updateModelItem,
    deleteModelItem,
    createViewItem,
    updateViewItem,
    deleteViewItem,
    createConnector,
    updateConnector,
    deleteConnector,
    createTextBox,
    updateTextBox,
    deleteTextBox,
    createRectangle,
    updateRectangle,
    deleteRectangle,
    changeLayerOrder,
    createFlow,
    updateFlow,
    deleteFlow,
    createFlowStep,
    updateFlowStep,
    deleteFlowStep,
    reorderFlowSteps
  };
};
