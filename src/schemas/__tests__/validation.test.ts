import { produce } from 'immer';
import { Connector, Flow, ViewItem } from 'src/types';
import { model as modelFixture } from '../../fixtures/model';
import { validateModel } from '../validation';
import { connectorSchema } from '../connector';
import { flowSchema } from '../flow';

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
});
