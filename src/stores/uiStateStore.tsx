import React, { createContext, useContext, useRef } from 'react';
import { createStore, useStore } from 'zustand';
import {
  CoordsUtils,
  incrementZoom,
  decrementZoom,
  getStartingMode,
  flowPlaybackReducer
} from 'src/utils';
import { UiStateStore } from 'src/types';
import { INITIAL_UI_STATE } from 'src/config';

const initialState = () => {
  return createStore<UiStateStore>((set, get) => {
    return {
      zoom: INITIAL_UI_STATE.zoom,
      scroll: INITIAL_UI_STATE.scroll,
      flowPlayback: INITIAL_UI_STATE.flowPlayback,
      activeNodePulse: INITIAL_UI_STATE.activeNodePulse,
      view: '',
      mainMenuOptions: [],
      editorMode: 'EXPLORABLE_READONLY',
      mode: getStartingMode('EXPLORABLE_READONLY'),
      iconCategoriesState: [],
      isMainMenuOpen: false,
      dialog: null,
      rendererEl: null,
      contextMenu: null,
      mouse: {
        position: { screen: CoordsUtils.zero(), tile: CoordsUtils.zero() },
        mousedown: null,
        delta: null
      },
      itemControls: null,
      enableDebugTools: false,
      actions: {
        setView: (view) => {
          set({ view });
        },
        setMainMenuOptions: (mainMenuOptions) => {
          set({ mainMenuOptions });
        },
        setEditorMode: (mode) => {
          set({ editorMode: mode, mode: getStartingMode(mode) });
        },
        setIconCategoriesState: (iconCategoriesState) => {
          set({ iconCategoriesState });
        },
        resetUiState: () => {
          set({
            mode: getStartingMode(get().editorMode),
            scroll: {
              position: CoordsUtils.zero(),
              offset: CoordsUtils.zero()
            },
            itemControls: null,
            zoom: 1,
            flowPlayback: INITIAL_UI_STATE.flowPlayback,
            activeNodePulse: INITIAL_UI_STATE.activeNodePulse
          });
        },
        setMode: (mode) => {
          set({ mode });
        },
        setDialog: (dialog) => {
          set({ dialog });
        },
        setIsMainMenuOpen: (isMainMenuOpen) => {
          set({ isMainMenuOpen, itemControls: null });
        },
        incrementZoom: () => {
          const { zoom } = get();
          set({ zoom: incrementZoom(zoom) });
        },
        decrementZoom: () => {
          const { zoom } = get();
          set({ zoom: decrementZoom(zoom) });
        },
        setZoom: (zoom) => {
          set({ zoom });
        },
        setScroll: ({ position, offset }) => {
          set({ scroll: { position, offset: offset ?? get().scroll.offset } });
        },
        setItemControls: (itemControls) => {
          set({ itemControls });
        },
        setContextMenu: (contextMenu) => {
          set({ contextMenu });
        },
        setMouse: (mouse) => {
          set({ mouse });
        },
        setEnableDebugTools: (enableDebugTools) => {
          set({ enableDebugTools });
        },
        setRendererEl: (el) => {
          set({ rendererEl: el });
        },
        selectFlow: (flowId, flow) => {
          set({
            flowPlayback: flowPlaybackReducer(
              get().flowPlayback,
              { type: 'SELECT_FLOW', flowId },
              flow
            )
          });
        },
        play: (flow) => {
          set({
            flowPlayback: flowPlaybackReducer(
              get().flowPlayback,
              { type: 'PLAY' },
              flow
            )
          });
        },
        pause: () => {
          set({
            flowPlayback: flowPlaybackReducer(get().flowPlayback, {
              type: 'PAUSE'
            })
          });
        },
        stop: (flow) => {
          set({
            flowPlayback: flowPlaybackReducer(
              get().flowPlayback,
              { type: 'STOP' },
              flow
            )
          });
        },
        nextStep: (flow) => {
          set({
            flowPlayback: flowPlaybackReducer(
              get().flowPlayback,
              { type: 'NEXT_STEP' },
              flow
            )
          });
        },
        prevStep: (flow) => {
          set({
            flowPlayback: flowPlaybackReducer(
              get().flowPlayback,
              { type: 'PREV_STEP' },
              flow
            )
          });
        },
        setSpeed: (speed) => {
          set({
            flowPlayback: flowPlaybackReducer(get().flowPlayback, {
              type: 'SET_SPEED',
              speed
            })
          });
        },
        advance: (flow, stepId) => {
          set({
            flowPlayback: flowPlaybackReducer(
              get().flowPlayback,
              { type: 'ADVANCE', stepId },
              flow
            )
          });
        },
        // FlowPlaybackReconciler.tsx now hands us the Flow it resolved plus
        // the precise per-id active-connector list (T2b): the reducer can
        // drop a step deleted from the model and reseed from
        // getFlowStartSteps when the active set would otherwise empty out,
        // instead of the old all-or-nothing approximation this store had to
        // fall back to when it couldn't see the model.
        reconcile: (
          stepsCount,
          flowExists,
          activeConnectorStepIds,
          flow,
          checkedStepIds
        ) => {
          const { flowPlayback } = get();

          set({
            flowPlayback: flowPlaybackReducer(
              flowPlayback,
              {
                type: 'RECONCILE',
                flowExists,
                stepsCount,
                activeConnectorStepIds,
                checkedStepIds
              },
              flow
            )
          });
        },
        setActiveNodePulse: (activeNodePulse) => {
          set({ activeNodePulse });
        }
      }
    };
  });
};

const UiStateContext = createContext<ReturnType<typeof initialState> | null>(
  null
);

interface ProviderProps {
  children: React.ReactNode;
}

// TODO: Typings below are pretty gnarly due to the way Zustand works.
// see https://github.com/pmndrs/zustand/discussions/1180#discussioncomment-3439061
export const UiStateProvider = ({ children }: ProviderProps) => {
  const storeRef = useRef<ReturnType<typeof initialState>>();

  if (!storeRef.current) {
    storeRef.current = initialState();
  }

  return (
    <UiStateContext.Provider value={storeRef.current}>
      {children}
    </UiStateContext.Provider>
  );
};

export function useUiStateStore<T>(selector: (state: UiStateStore) => T) {
  const store = useContext(UiStateContext);

  if (store === null) {
    throw new Error('Missing provider in the tree');
  }

  const value = useStore(store, selector);
  return value;
}
