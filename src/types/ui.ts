import { Coords, EditorModeEnum, MainMenuOptions } from './common';
import { Flow, Icon } from './model';
import { ItemReference } from './scene';

interface AddItemControls {
  type: 'ADD_ITEM';
}

export type ItemControls = ItemReference | AddItemControls;

export interface Mouse {
  position: {
    screen: Coords;
    tile: Coords;
  };
  mousedown: {
    screen: Coords;
    tile: Coords;
  } | null;
  delta: {
    screen: Coords;
    tile: Coords;
  } | null;
}

// Mode types
export interface InteractionsDisabled {
  type: 'INTERACTIONS_DISABLED';
  showCursor: boolean;
}

export interface CursorMode {
  type: 'CURSOR';
  showCursor: boolean;
  mousedownItem: ItemReference | null;
}

export interface DragItemsMode {
  type: 'DRAG_ITEMS';
  showCursor: boolean;
  items: ItemReference[];
  isInitialMovement: Boolean;
}

export interface PanMode {
  type: 'PAN';
  showCursor: boolean;
}

export interface PlaceIconMode {
  type: 'PLACE_ICON';
  showCursor: boolean;
  id: string | null;
}

export interface ConnectorMode {
  type: 'CONNECTOR';
  showCursor: boolean;
  id: string | null;
}

export interface DrawRectangleMode {
  type: 'RECTANGLE.DRAW';
  showCursor: boolean;
  id: string | null;
}

export const AnchorPositionOptions = {
  BOTTOM_LEFT: 'BOTTOM_LEFT',
  BOTTOM_RIGHT: 'BOTTOM_RIGHT',
  TOP_RIGHT: 'TOP_RIGHT',
  TOP_LEFT: 'TOP_LEFT'
} as const;

export type AnchorPosition = keyof typeof AnchorPositionOptions;

export interface TransformRectangleMode {
  type: 'RECTANGLE.TRANSFORM';
  showCursor: boolean;
  id: string;
  selectedAnchor: AnchorPosition | null;
}

export interface TextBoxMode {
  type: 'TEXTBOX';
  showCursor: boolean;
  id: string | null;
}

export type Mode =
  | InteractionsDisabled
  | CursorMode
  | PanMode
  | PlaceIconMode
  | ConnectorMode
  | DrawRectangleMode
  | TransformRectangleMode
  | DragItemsMode
  | TextBoxMode;
// End mode types

export interface Scroll {
  position: Coords;
  offset: Coords;
}

export interface IconCollectionState {
  id?: string;
  isExpanded: boolean;
}

export type IconCollectionStateWithIcons = IconCollectionState & {
  icons: Icon[];
};

export const DialogTypeEnum = {
  EXPORT_IMAGE: 'EXPORT_IMAGE',
  FLOW_EDITOR: 'FLOW_EDITOR',
  ISSUES: 'ISSUES',
  SECURITY_REPORT: 'SECURITY_REPORT',
  COST_REPORT: 'COST_REPORT'
} as const;

export interface ContextMenu {
  item: ItemReference;
  tile: Coords;
}

export const LayerOrderingActionOptions = {
  BRING_TO_FRONT: 'BRING_TO_FRONT',
  SEND_TO_BACK: 'SEND_TO_BACK',
  BRING_FORWARD: 'BRING_FORWARD',
  SEND_BACKWARD: 'SEND_BACKWARD'
} as const;

export type LayerOrderingAction = keyof typeof LayerOrderingActionOptions;

export const FlowPlaybackStatusOptions = {
  IDLE: 'IDLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED'
} as const;

export type FlowPlaybackStatus = keyof typeof FlowPlaybackStatusOptions;

// Playback state for a running flow simulation. UI state only — never
// persisted in the model (see src/utils/flowPlayback.ts for the pure
// transition logic and src/hooks/useFlowPlayback.ts for the React glue).
export interface FlowPlayback {
  flowId: string | null;
  status: FlowPlaybackStatus;
  // The set of steps currently "in flight", in the order they appear in the
  // selected flow's `steps` array (not insertion order). A list flow (no
  // step declares `next`) never has more than one entry here, which is what
  // keeps a linear flow behaving exactly as it did with the old single
  // `stepIndex` cursor. A graph flow can have several, e.g. both sides of a
  // fork (see resolveNextSteps/getFlowStartSteps, src/utils/flow.ts, and
  // the ADVANCE/NEXT_STEP cases below for how the set advances).
  activeStepIds: string[];
  // Backward-compat projection of `activeStepIds[0]`'s position in the
  // selected flow's `steps` array, kept only because
  // src/components/FlowPlaybackReconciler/FlowPlaybackReconciler.tsx reads
  // `flowPlayback.stepIndex` straight off this store (bypassing
  // useFlowPlayback, which is where the rest of the app gets its
  // compatibility shims) and src/utils/flowPlayback.ts's RECONCILE case has
  // no way to hand it a real Flow to recompute a proper entry point from
  // (see the comment on the `reconcile` action in
  // src/stores/uiStateStore.tsx). When `activeStepIds` empties out (a
  // finished run, or a reconcile that couldn't reseed) this freezes at its
  // last value instead of resetting, mirroring the old ADVANCE behavior of
  // leaving stepIndex at `stepsCount - 1` so the finished flow's position
  // stays visible. T3 can retire this once the reconciler and the render
  // layer read `activeStepIds`/`activeSteps` directly instead.
  stepIndex: number;
  speed: number;
  // Bounded history of previous `activeStepIds` snapshots (oldest first),
  // pushed on every forward transition (NEXT_STEP, ADVANCE) so PREV_STEP has
  // something principled to restore. A graph step can have several
  // predecessors or sit in a cycle, so "decrement the cursor" has no defined
  // inverse the way it did for a flat array index; capped at
  // MAX_FLOW_PLAYBACK_HISTORY (src/config.ts) so a long run can't grow this
  // without bound.
  history: string[][];
}

// Which node should show a short arrival pulse (ConnectorPacket.tsx sets
// this when a packet reaches its destination, Node.tsx consumes it).
// `token` changes on every arrival so the same node can re-trigger its
// pulse animation on consecutive steps. UI state only, never persisted.
export interface NodePulse {
  nodeId: string;
  token: number;
}

export interface UiState {
  view: string;
  mainMenuOptions: MainMenuOptions;
  editorMode: keyof typeof EditorModeEnum;
  iconCategoriesState: IconCollectionState[];
  mode: Mode;
  dialog: keyof typeof DialogTypeEnum | null;
  isMainMenuOpen: boolean;
  itemControls: ItemControls | null;
  contextMenu: ContextMenu | null;
  zoom: number;
  scroll: Scroll;
  mouse: Mouse;
  rendererEl: HTMLDivElement | null;
  enableDebugTools: boolean;
  flowPlayback: FlowPlayback;
  activeNodePulse: NodePulse | null;
}

export interface UiStateActions {
  setView: (view: string) => void;
  setMainMenuOptions: (options: MainMenuOptions) => void;
  setEditorMode: (mode: keyof typeof EditorModeEnum) => void;
  setIconCategoriesState: (iconCategoriesState: IconCollectionState[]) => void;
  resetUiState: () => void;
  setMode: (mode: Mode) => void;
  incrementZoom: () => void;
  decrementZoom: () => void;
  setIsMainMenuOpen: (isOpen: boolean) => void;
  setDialog: (dialog: keyof typeof DialogTypeEnum | null) => void;
  setZoom: (zoom: number) => void;
  setScroll: (scroll: Scroll) => void;
  setItemControls: (itemControls: ItemControls | null) => void;
  setContextMenu: (contextMenu: ContextMenu | null) => void;
  setMouse: (mouse: Mouse) => void;
  setRendererEl: (el: HTMLDivElement) => void;
  setEnableDebugTools: (enabled: boolean) => void;
  selectFlow: (flowId: string | null, flow: Flow | undefined) => void;
  play: () => void;
  pause: () => void;
  stop: (flow: Flow | undefined) => void;
  nextStep: (flow: Flow | undefined) => void;
  prevStep: (flow: Flow | undefined) => void;
  setSpeed: (speed: number) => void;
  advance: (flow: Flow | undefined, stepId: string) => void;
  // Signature kept exactly as before T2 (positional stepsCount, flowExists,
  // connectorExists) because its only caller,
  // src/components/FlowPlaybackReconciler/FlowPlaybackReconciler.tsx, is out
  // of scope for this change and calls it with these three arguments. See
  // the `reconcile` action body in src/stores/uiStateStore.tsx for how this
  // gets adapted onto the new, plural RECONCILE reducer case.
  reconcile: (
    stepsCount: number,
    flowExists: boolean,
    connectorExists: boolean
  ) => void;
  setActiveNodePulse: (pulse: NodePulse | null) => void;
}

export type UiStateStore = UiState & {
  actions: UiStateActions;
};
