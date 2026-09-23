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
        play: () => {
          set({
            flowPlayback: flowPlaybackReducer(get().flowPlayback, {
              type: 'PLAY'
            })
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
        // Signature intentionally unchanged from before T2: its only
        // caller, FlowPlaybackReconciler.tsx, is out of scope for this
        // change and calls it positionally as
        // actions.reconcile(stepsCount, flowExists, connectorExists). That
        // component resolves a single boolean for the one step at its
        // (legacy) stepIndex cursor, and has no Flow object to hand us - this
        // store only ever sees UI/playback state, never model data (see
        // src/stores/modelStore.tsx: a separate per-provider store, not a
        // reachable singleton). So the plural RECONCILE reducer case is fed
        // the best approximation this input allows: when the checked
        // connector is fine, every currently active step is treated as
        // fine; when it's missing, every currently active step is treated
        // as missing. That's exactly the old all-or-nothing behavior this
        // caller has always driven for a single-active-step (list) flow,
        // and the reducer degrades to it gracefully (see the RECONCILE case
        // in src/utils/flowPlayback.ts) without a Flow to reseed real entry
        // points from.
        reconcile: (stepsCount, flowExists, connectorExists) => {
          const { flowPlayback } = get();
          const activeConnectorStepIds = connectorExists
            ? flowPlayback.activeStepIds
            : [];

          set({
            flowPlayback: flowPlaybackReducer(flowPlayback, {
              type: 'RECONCILE',
              flowExists,
              stepsCount,
              activeConnectorStepIds
            })
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
