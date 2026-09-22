import z from 'zod';
import {
  iconSchema,
  modelSchema,
  modelItemSchema,
  modelItemsSchema,
  viewsSchema,
  viewSchema,
  viewItemSchema,
  connectorSchema,
  iconsSchema,
  colorsSchema,
  anchorSchema,
  textBoxSchema,
  rectangleSchema,
  connectorStyleOptions,
  connectorDirectionOptions,
  flowSchema,
  flowStepSchema,
  flowsSchema,
  flowStepDirectionOptions,
  iconStyleOptions,
  resourceKindOptions,
  environmentOptions,
  connectorProtocolOptions,
  connectorModeOptions,
  connectorAuthOptions,
  zoneKindOptions,
  zoneVisibilityOptions,
  dataClassificationOptions
} from 'src/schemas';
import { StoreApi } from 'zustand';

export { connectorStyleOptions } from 'src/schemas';
export { connectorDirectionOptions } from 'src/schemas';
export { flowStepDirectionOptions } from 'src/schemas';
export { iconStyleOptions } from 'src/schemas';
export { resourceKindOptions } from 'src/schemas';
export { environmentOptions } from 'src/schemas';
export { connectorProtocolOptions } from 'src/schemas';
export { connectorModeOptions } from 'src/schemas';
export { connectorAuthOptions } from 'src/schemas';
export { zoneKindOptions } from 'src/schemas';
export { zoneVisibilityOptions } from 'src/schemas';
export { dataClassificationOptions } from 'src/schemas';
export type Model = z.infer<typeof modelSchema>;
export type ModelItems = z.infer<typeof modelItemsSchema>;
export type Icon = z.infer<typeof iconSchema>;
export type Icons = z.infer<typeof iconsSchema>;
export type Colors = z.infer<typeof colorsSchema>;
export type ModelItem = z.infer<typeof modelItemSchema>;
export type Views = z.infer<typeof viewsSchema>;
export type View = z.infer<typeof viewSchema>;
export type ViewItem = z.infer<typeof viewItemSchema>;
export type ConnectorStyle = keyof typeof connectorStyleOptions;
export type ConnectorDirection = keyof typeof connectorDirectionOptions;
export type ConnectorAnchor = z.infer<typeof anchorSchema>;
export type Connector = z.infer<typeof connectorSchema>;
export type TextBox = z.infer<typeof textBoxSchema>;
export type Rectangle = z.infer<typeof rectangleSchema>;
export type FlowStep = z.infer<typeof flowStepSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type Flows = z.infer<typeof flowsSchema>;
export type FlowStepDirection = (typeof flowStepDirectionOptions)[number];
export type IconStyle = (typeof iconStyleOptions)[number];
export type ResourceKind = (typeof resourceKindOptions)[number];
export type Environment = (typeof environmentOptions)[number];
export type ConnectorProtocol = (typeof connectorProtocolOptions)[number];
// Named `ConnectorCommunicationMode` (not `ConnectorMode`) to avoid
// colliding with the unrelated `ConnectorMode` interaction mode in
// src/types/ui.ts (the "drawing a connector" cursor mode).
export type ConnectorCommunicationMode = (typeof connectorModeOptions)[number];
export type ConnectorAuth = (typeof connectorAuthOptions)[number];
export type ZoneKind = (typeof zoneKindOptions)[number];
export type ZoneVisibility = (typeof zoneVisibilityOptions)[number];
export type DataClassification = (typeof dataClassificationOptions)[number];

export type ModelStore = Model & {
  actions: {
    get: StoreApi<ModelStore>['getState'];
    set: StoreApi<ModelStore>['setState'];
  };
};
