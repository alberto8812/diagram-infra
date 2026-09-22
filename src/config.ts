import {
  Size,
  InitialData,
  MainMenuOptions,
  Icon,
  Connector,
  TextBox,
  ViewItem,
  View,
  Rectangle,
  Colors,
  FlowPlayback,
  IconStyle
} from 'src/types';
import { CoordsUtils } from 'src/utils';
import { customVars } from './styles/theme';

// TODO: This file could do with better organisation and convention for easier reading.
export const UNPROJECTED_TILE_SIZE = 100;
export const TILE_PROJECTION_MULTIPLIERS: Size = {
  width: 1.415,
  height: 0.819
};
export const PROJECTED_TILE_SIZE = {
  width: UNPROJECTED_TILE_SIZE * TILE_PROJECTION_MULTIPLIERS.width,
  height: UNPROJECTED_TILE_SIZE * TILE_PROJECTION_MULTIPLIERS.height
};

export const DEFAULT_COLOR: Colors[0] = {
  id: '__DEFAULT__',
  value: customVars.customPalette.defaultColor
};

export const DEFAULT_FONT_FAMILY = 'Roboto, Arial, sans-serif';

export const VIEW_DEFAULTS: Required<
  Omit<View, 'id' | 'description' | 'lastUpdated'>
> = {
  name: 'Untitled view',
  items: [],
  connectors: [],
  rectangles: [],
  textBoxes: []
};

export const VIEW_ITEM_DEFAULTS: Required<Omit<ViewItem, 'id' | 'tile'>> = {
  labelHeight: 80
};

// `protocol`, `port`, `mode` and `auth` (roadmap item 2,
// src/schemas/connector.ts) are deliberately excluded here instead of given
// an invented value: this object gets spread onto every connector wherever
// it's read (see src/hooks/useScene.ts `connectors`), and that merged value
// is what gets written back to the model on interactions like dragging a
// connector anchor (src/interaction/modes/DragItems.ts). A concrete
// protocol/port/mode/auth has no neutral choice and would silently start
// writing onto connectors that never had one set. Every reader treats an
// undefined `mode` as `sync` instead (see src/utils/flow.ts
// `buildReturnPathSteps` and the mode toggle in ConnectorControls), which
// matches the existing (pre-this-feature) simulation behavior for a
// connector with no mode set.
export const CONNECTOR_DEFAULTS: Required<
  Omit<Connector, 'id' | 'color' | 'protocol' | 'port' | 'auth' | 'mode'>
> = {
  width: 10,
  description: '',
  anchors: [],
  style: 'SOLID',
  animated: false,
  direction: 'FORWARD'
};

// The boundaries of the search area for the pathfinder algorithm
// is the grid that encompasses the two nodes + the offset below.
export const CONNECTOR_SEARCH_OFFSET = { x: 1, y: 1 };

export const TEXTBOX_DEFAULTS: Required<Omit<TextBox, 'id' | 'tile'>> = {
  orientation: 'X',
  fontSize: 0.6,
  content: 'Text'
};

export const TEXTBOX_PADDING = 0.2;
export const TEXTBOX_FONT_WEIGHT = 'bold';

// `zone`, `name` and `visibility` (P0, src/schemas/rectangle.ts) are
// deliberately excluded here, same reasoning as CONNECTOR_DEFAULTS above:
// this object gets spread onto every rectangle wherever it's read (see
// src/hooks/useScene.ts `rectangles`), and that merged value is what gets
// written back to the model on interactions like dragging a rectangle. A
// concrete zone kind has no neutral choice and would silently start
// labelling every plain (decoration-only) rectangle as a typed zone.
export const RECTANGLE_DEFAULTS: Required<
  Omit<
    Rectangle,
    'id' | 'from' | 'to' | 'color' | 'zone' | 'name' | 'visibility'
  >
> = {};

export const ZOOM_INCREMENT = 0.2;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 1;
export const TRANSFORM_ANCHOR_SIZE = 30;
export const TRANSFORM_CONTROLS_COLOR = '#0392ff';
export const INITIAL_DATA: InitialData = {
  title: 'Untitled',
  version: '',
  icons: [],
  colors: [DEFAULT_COLOR],
  items: [],
  views: [],
  fitToView: false
};
// Default duration for a flow step's packet animation when the step itself
// does not set one. Effective duration = durationMs / playback speed.
export const DEFAULT_FLOW_STEP_DURATION_MS = 1200;

export const INITIAL_FLOW_PLAYBACK: FlowPlayback = {
  flowId: null,
  status: 'IDLE',
  stepIndex: 0,
  speed: 1
};

// Speed multipliers offered by the playback controls (FlowPlaybackBar).
export const FLOW_PLAYBACK_SPEED_OPTIONS = [0.5, 1, 2] as const;

export const INITIAL_UI_STATE = {
  zoom: 1,
  scroll: {
    position: CoordsUtils.zero(),
    offset: CoordsUtils.zero()
  },
  flowPlayback: INITIAL_FLOW_PLAYBACK,
  activeNodePulse: null
};
export const INITIAL_SCENE_STATE = {
  connectors: {},
  textBoxes: {}
};
export const MAIN_MENU_OPTIONS: MainMenuOptions = [
  'ACTION.OPEN',
  'EXPORT.JSON',
  'EXPORT.PNG',
  'ACTION.CLEAR_CANVAS',
  'LINK.DISCORD',
  'LINK.GITHUB',
  'VERSION'
];

export const DEFAULT_ICON: Icon = {
  id: 'default',
  name: 'block',
  isIsometric: true,
  url: ''
};

export const DEFAULT_LABEL_HEIGHT = 20;
export const PROJECT_BOUNDING_BOX_PADDING = 3;
export const MARKDOWN_EMPTY_VALUE = '<p><br></p>';

// T6: non-isometric (flat) icons render on an extruded isometric block by
// default (opt-out via a model item's own `iconStyle`, see
// src/schemas/modelItems.ts). Isometric icons are unaffected.
export const NODE_ICON_STYLE_DEFAULT: IconStyle = 'BLOCK';
export const ICON_BLOCK_EXTRUDE_HEIGHT = Math.round(
  PROJECTED_TILE_SIZE.height * 0.35
);
export const ICON_BLOCK_BASE_COLOR = '#e7ecf5';
