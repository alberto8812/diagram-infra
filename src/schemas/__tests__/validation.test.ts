import { produce } from 'immer';
import { Connector, Flow, ViewItem } from 'src/types';
import { model as modelFixture } from '../../fixtures/model';
import { validateModel } from '../validation';
import { connectorSchema } from '../connector';
import { flowSchema } from '../flow';
import { modelItemSchema } from '../modelItems';

describe('Model validation works correctly', () => {
  test('Model fixture is valid', () => {
    const issues = validateModel(modelFixture);

    expect(issues.length).toStrictEqual(0);
  });

  test('Connector with anchor that references an invalid item fails validation', () => {
    const invalidConnector: Connector = {
      id: 'invalidConnector',
      color: 'color1',
      anchors: [
        { id: 'testAnch', ref: { item: 'node1' } },
        { id: 'testAnch2', ref: { item: 'invalidItem' } }
      ]
    };

    const model = produce(modelFixture, (draft) => {
      draft.views[0].connectors?.push(invalidConnector);
    });

    const issues = validateModel(model);

    expect(issues[0].type).toStrictEqual('INVALID_ANCHOR_TO_VIEW_ITEM_REF');
  });

  test('Connector with less than two anchors fails validation', () => {
    const invalidConnector: Connector = {
      id: 'invalidConnector',
      color: 'color1',
      anchors: []
    };

    const model = produce(modelFixture, (draft) => {
      draft.views[0].connectors?.push(invalidConnector);
    });

    const issues = validateModel(model);

    expect(issues[0].type).toStrictEqual('CONNECTOR_TOO_FEW_ANCHORS');
  });

  test('Connector with anchor that references an invalid anchor fails validation', () => {
    const invalidConnector: Connector = {
      id: 'invalidConnector',
      color: 'color1',
      anchors: [
        { id: 'testAnch1', ref: { anchor: 'invalidAnchor' } },
        { id: 'testAnch2', ref: { anchor: 'anchor1' } }
      ]
    };

    const model = produce(modelFixture, (draft) => {
      draft.views[0].connectors?.push(invalidConnector);
    });

    const issues = validateModel(model);

    expect(issues[0].type).toStrictEqual('INVALID_ANCHOR_TO_ANCHOR_REF');
  });

  test('An invalid view item fails validation', () => {
    const invalidItem: ViewItem = {
      id: 'invalidItem',
      tile: {
        x: 0,
        y: 0
      }
    };

    const model = produce(modelFixture, (draft) => {
      draft.views[0].items.push(invalidItem);
    });

    const issues = validateModel(model);

    expect(issues[0].type).toStrictEqual('INVALID_VIEW_ITEM_TO_MODEL_ITEM_REF');
  });

  test('A connector with an invalid color fails validation', () => {
    const invalidConnector: Connector = {
      id: 'invalidConnector',
      color: 'invalidColor',
      anchors: []
    };

    const model = produce(modelFixture, (draft) => {
      draft.views[0].connectors?.push(invalidConnector);
    });

    const issues = validateModel(model);

    expect(issues[0].type).toStrictEqual('INVALID_CONNECTOR_COLOR_REF');
  });

  test('A rectangle with an invalid color fails validation', () => {
    const invalidRectangle = {
      id: 'invalidRectangle',
      color: 'invalidColor',
      from: { x: 0, y: 0 },
      to: { x: 2, y: 2 }
    };

    const model = produce(modelFixture, (draft) => {
      draft.views[0].rectangles?.push(invalidRectangle);
    });

    const issues = validateModel(model);

    expect(issues[0].type).toStrictEqual('INVALID_RECTANGLE_COLOR_REF');
  });

  test('A connector with animated and direction set is valid', () => {
    const result = connectorSchema.safeParse({
      id: 'connectorWithFlow',
      color: 'color1',
      animated: true,
      direction: 'REVERSE',
      anchors: [
        { id: 'testAnch1', ref: { item: 'node1' } },
        { id: 'testAnch2', ref: { item: 'node2' } }
      ]
    });

    expect(result.success).toBe(true);
  });

  test('A connector with an invalid direction fails validation', () => {
    const result = connectorSchema.safeParse({
      id: 'connectorWithInvalidDirection',
      color: 'color1',
      animated: true,
      direction: 'SIDEWAYS',
      anchors: [
        { id: 'testAnch1', ref: { item: 'node1' } },
        { id: 'testAnch2', ref: { item: 'node2' } }
      ]
    });

    expect(result.success).toBe(false);
  });

  test('A connector without animated or direction still validates', () => {
    const result = connectorSchema.safeParse({
      id: 'connectorWithoutFlow',
      color: 'color1',
      anchors: [
        { id: 'testAnch1', ref: { item: 'node1' } },
        { id: 'testAnch2', ref: { item: 'node2' } }
      ]
    });

    expect(result.success).toBe(true);
  });

  test('A valid flow validates', () => {
    const result = flowSchema.safeParse({
      id: 'flow1',
      name: 'Checkout request',
      description: 'Client requests checkout and receives a response',
      steps: [
        {
          id: 'step1',
          connectorId: 'connector1',
          direction: 'REQUEST',
          label: 'GET /checkout',
          durationMs: 800
        },
        {
          id: 'step2',
          connectorId: 'connector1',
          direction: 'RESPONSE'
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  test('A flow step with an invalid direction fails validation', () => {
    const result = flowSchema.safeParse({
      id: 'flow1',
      name: 'Invalid flow',
      steps: [
        {
          id: 'step1',
          connectorId: 'connector1',
          direction: 'SIDEWAYS'
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  test('A model without flows still validates', () => {
    const issues = validateModel(modelFixture);

    expect(modelFixture.flows).toBeUndefined();
    expect(issues.length).toStrictEqual(0);
  });

  test('A flow step referencing a non-existant connector fails model validation', () => {
    const invalidFlow: Flow = {
      id: 'invalidFlow',
      name: 'Invalid flow',
      steps: [
        {
          id: 'step1',
          connectorId: 'nonExistantConnector',
          direction: 'REQUEST'
        }
      ]
    };

    const model = produce(modelFixture, (draft) => {
      draft.flows = [invalidFlow];
    });

    const issues = validateModel(model);

    expect(issues[0].type).toStrictEqual('INVALID_FLOW_STEP_CONNECTOR_REF');
  });

  test('A flow whose steps reference existing connectors passes model validation', () => {
    const validFlow: Flow = {
      id: 'validFlow',
      name: 'Valid flow',
      steps: [
        { id: 'step1', connectorId: 'connector1', direction: 'REQUEST' },
        { id: 'step2', connectorId: 'connector2', direction: 'REQUEST' },
        {
          id: 'step2-response',
          connectorId: 'connector2',
          direction: 'RESPONSE'
        },
        {
          id: 'step1-response',
          connectorId: 'connector1',
          direction: 'RESPONSE'
        }
      ]
    };

    const model = produce(modelFixture, (draft) => {
      draft.flows = [validFlow];
    });

    const issues = validateModel(model);

    expect(issues.length).toStrictEqual(0);
  });

  test('A model item with all resource fields set is valid', () => {
    const result = modelItemSchema.safeParse({
      id: 'resourceItem',
      name: 'API',
      kind: 'service',
      environment: 'prod',
      engine: 'node',
      version: '20',
      region: 'us-east-1',
      owner: 'platform-team',
      port: 8080
    });

    expect(result.success).toBe(true);
  });

  test('A model item without any resource fields is still valid', () => {
    const model = produce(modelFixture, (draft) => {
      draft.items.push({ id: 'plainItem', name: 'Plain item' });
    });

    const issues = validateModel(model);

    expect(issues.length).toStrictEqual(0);
  });

  test('A model item with an invalid kind fails validation', () => {
    const result = modelItemSchema.safeParse({
      id: 'invalidKindItem',
      name: 'Invalid kind',
      kind: 'container'
    });

    expect(result.success).toBe(false);
  });

  test('A model item with an invalid environment fails validation', () => {
    const result = modelItemSchema.safeParse({
      id: 'invalidEnvironmentItem',
      name: 'Invalid environment',
      environment: 'staging'
    });

    expect(result.success).toBe(false);
  });

  test('A model item with port 0 fails validation', () => {
    const result = modelItemSchema.safeParse({
      id: 'invalidPortLowItem',
      name: 'Invalid low port',
      port: 0
    });

    expect(result.success).toBe(false);
  });

  test('A model item with port 70000 fails validation', () => {
    const result = modelItemSchema.safeParse({
      id: 'invalidPortHighItem',
      name: 'Invalid high port',
      port: 70000
    });

    expect(result.success).toBe(false);
  });

  test('A model item with a non-integer port fails validation', () => {
    const result = modelItemSchema.safeParse({
      id: 'invalidPortFractionItem',
      name: 'Invalid fractional port',
      port: 1.5
    });

    expect(result.success).toBe(false);
  });

  test('A model item with a group set round-trips through modelItemSchema', () => {
    const result = modelItemSchema.safeParse({
      id: 'groupedItem',
      name: 'API',
      group: 'Backend'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.group).toStrictEqual('Backend');
    }
  });

  test('A model item without a group still parses, and group is absent', () => {
    const result = modelItemSchema.safeParse({
      id: 'ungroupedItem',
      name: 'API'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('group');
    }
  });

  test('A model item with a group over the shared label max length fails validation', () => {
    const result = modelItemSchema.safeParse({
      id: 'invalidGroupItem',
      name: 'Invalid group',
      group: 'a'.repeat(61)
    });

    expect(result.success).toBe(false);
  });

  test('A connector with all semantic fields set is valid', () => {
    const result = connectorSchema.safeParse({
      id: 'semanticConnector',
      anchors: [],
      protocol: 'HTTPS',
      port: 443,
      mode: 'async',
      auth: 'mtls'
    });

    expect(result.success).toBe(true);
  });

  test('A connector without any semantic fields is still valid', () => {
    const model = produce(modelFixture, (draft) => {
      draft.views[0].connectors = [
        ...(draft.views[0].connectors ?? []),
        {
          id: 'plainConnector',
          anchors: [
            { id: 'plainAnch1', ref: { item: 'node1' } },
            { id: 'plainAnch2', ref: { item: 'node2' } }
          ]
        }
      ];
    });

    const issues = validateModel(model);

    expect(issues.length).toStrictEqual(0);
  });

  test('A connector with an invalid protocol fails validation', () => {
    const result = connectorSchema.safeParse({
      id: 'invalidProtocolConnector',
      anchors: [],
      protocol: 'FTP'
    });

    expect(result.success).toBe(false);
  });

  test('A connector with an invalid mode fails validation', () => {
    const result = connectorSchema.safeParse({
      id: 'invalidModeConnector',
      anchors: [],
      mode: 'fireAndForget'
    });

    expect(result.success).toBe(false);
  });

  test('A connector with an invalid auth fails validation', () => {
    const result = connectorSchema.safeParse({
      id: 'invalidAuthConnector',
      anchors: [],
      auth: 'oauth2'
    });

    expect(result.success).toBe(false);
  });

  test('A connector with port 0 fails validation', () => {
    const result = connectorSchema.safeParse({
      id: 'invalidPortLowConnector',
      anchors: [],
      port: 0
    });

    expect(result.success).toBe(false);
  });

  test('A connector with port 70000 fails validation', () => {
    const result = connectorSchema.safeParse({
      id: 'invalidPortHighConnector',
      anchors: [],
      port: 70000
    });

    expect(result.success).toBe(false);
  });

  test('A connector with a non-integer port fails validation', () => {
    const result = connectorSchema.safeParse({
      id: 'invalidPortFractionConnector',
      anchors: [],
      port: 1.5
    });

    expect(result.success).toBe(false);
  });
});
