import { produce } from 'immer';
import { model as modelFixture } from 'src/fixtures/model';
import { Flow } from 'src/types';
import { getItemByIdOrThrow, hasExplicitSuccessors } from 'src/utils';
import * as reducers from 'src/stores/reducers';
import {
  createFlow,
  updateFlow,
  deleteFlow,
  createFlowStep,
  updateFlowStep,
  deleteFlowStep,
  reorderFlowSteps,
  setFlowStepSuccessors
} from '../flow';

const scene = {
  connectors: {},
  textBoxes: {}
};

const testFlow: Flow = {
  id: 'flow1',
  name: 'Checkout request',
  steps: [
    { id: 'step1', connectorId: 'connector1', direction: 'REQUEST' },
    { id: 'step2', connectorId: 'connector2', direction: 'REQUEST' }
  ]
};

const getModelWithFlow = () => {
  return produce(modelFixture, (draft) => {
    draft.flows = [testFlow];
  });
};

describe('Flow reducers works correctly', () => {
  test('Flow is added to model correctly', () => {
    const newState = createFlow(testFlow, { model: modelFixture, scene });

    expect(newState.model.flows).toHaveLength(1);
    expect(newState.model.flows?.[0]).toStrictEqual(testFlow);
  });

  test('Flow is updated correctly', () => {
    const newState = updateFlow(
      'flow1',
      { name: 'Renamed flow' },
      { model: getModelWithFlow(), scene }
    );

    const updatedFlow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow1');

    expect(updatedFlow.value.name).toBe('Renamed flow');
  });

  test('Flow is deleted correctly', () => {
    const newState = deleteFlow('flow1', { model: getModelWithFlow(), scene });

    expect(newState.model.flows).toHaveLength(0);
  });

  test('Flow step is added correctly', () => {
    const newStep = {
      id: 'step3',
      connectorId: 'connector2',
      direction: 'RESPONSE'
    } as const;

    const newState = createFlowStep(
      { flowId: 'flow1', step: newStep },
      { model: getModelWithFlow(), scene }
    );

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow1');

    expect(flow.value.steps).toHaveLength(3);
    expect(flow.value.steps[2]).toStrictEqual(newStep);
  });

  test('Flow step is updated correctly', () => {
    const newState = updateFlowStep(
      { flowId: 'flow1', stepId: 'step1', updates: { label: 'GET /checkout' } },
      { model: getModelWithFlow(), scene }
    );

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow1');
    const step = getItemByIdOrThrow(flow.value.steps, 'step1');

    expect(step.value.label).toBe('GET /checkout');
  });

  test('Flow step is deleted correctly', () => {
    const newState = deleteFlowStep(
      { flowId: 'flow1', stepId: 'step1' },
      { model: getModelWithFlow(), scene }
    );

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow1');

    expect(flow.value.steps).toHaveLength(1);
    expect(flow.value.steps[0].id).toBe('step2');
  });

  test('Flow step is reordered correctly', () => {
    const newState = reorderFlowSteps(
      { flowId: 'flow1', stepId: 'step2', toIndex: 0 },
      { model: getModelWithFlow(), scene }
    );

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow1');

    expect(flow.value.steps[0].id).toBe('step2');
    expect(flow.value.steps[1].id).toBe('step1');
  });

  test('Deleting a connector removes flow steps that reference it', () => {
    const model = getModelWithFlow();

    const newState = reducers.view({
      action: 'DELETE_CONNECTOR',
      payload: 'connector1',
      ctx: { viewId: 'view1', state: { model, scene } }
    });

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow1');

    expect(flow.value.steps).toHaveLength(1);
    expect(flow.value.steps[0].connectorId).toBe('connector2');
  });
});

describe('setFlowStepSuccessors() works correctly', () => {
  // testFlow is a pure list (no step declares `next`): step1, step2.
  const listFlow: Flow = {
    id: 'flow-list',
    name: 'List flow',
    steps: [
      { id: 'step1', connectorId: 'connector1', direction: 'REQUEST' },
      { id: 'step2', connectorId: 'connector2', direction: 'REQUEST' },
      { id: 'step3', connectorId: 'connector1', direction: 'RESPONSE' }
    ]
  };

  const getModelWithListFlow = () => {
    return produce(modelFixture, (draft) => {
      draft.flows = [listFlow];
    });
  };

  test('setting successors on a LIST flow backfills the others from array order', () => {
    const newState = setFlowStepSuccessors(
      { flowId: 'flow-list', stepId: 'step1', next: ['step3'] },
      { model: getModelWithListFlow(), scene }
    );

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow-list');

    // The edited step gets exactly the successors it was given.
    expect(getItemByIdOrThrow(flow.value.steps, 'step1').value.next).toEqual([
      'step3'
    ]);

    // The other steps are backfilled from their existing array order, not
    // left as dead ends: step2 chained to step3 (its array successor), and
    // step3 (last in the array) chains to nothing.
    expect(getItemByIdOrThrow(flow.value.steps, 'step2').value.next).toEqual([
      'step3'
    ]);
    expect(getItemByIdOrThrow(flow.value.steps, 'step3').value.next).toEqual(
      []
    );

    expect(hasExplicitSuccessors(flow.value.steps)).toBe(true);
  });

  // The dangerous case: a flow that already declares successors elsewhere
  // must NOT be backfilled when one more step's successors are set. A step
  // without `next` in a graph flow is terminal on purpose; backfilling it
  // here would silently turn a deliberate ending into a chain.
  test('setting successors on a flow that ALREADY has successors does NOT backfill', () => {
    const graphFlow: Flow = {
      id: 'flow-graph',
      name: 'Graph flow',
      steps: [
        {
          id: 'step1',
          connectorId: 'connector1',
          direction: 'REQUEST',
          next: ['step3']
        },
        // step2 declares no `next`: a deliberate terminal step in this
        // already-graph flow.
        { id: 'step2', connectorId: 'connector2', direction: 'REQUEST' },
        {
          id: 'step3',
          connectorId: 'connector1',
          direction: 'RESPONSE',
          next: []
        }
      ]
    };

    const model = produce(modelFixture, (draft) => {
      draft.flows = [graphFlow];
    });

    const newState = setFlowStepSuccessors(
      { flowId: 'flow-graph', stepId: 'step3', next: ['step1'] },
      { model, scene }
    );

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow-graph');

    // The named step is updated...
    expect(getItemByIdOrThrow(flow.value.steps, 'step3').value.next).toEqual([
      'step1'
    ]);

    // ...but step2, which was already terminal on purpose, stays terminal —
    // it must NOT be given a `next` it never had.
    expect(
      getItemByIdOrThrow(flow.value.steps, 'step2').value.next
    ).toBeUndefined();

    // step1, untouched by this call, keeps exactly what it already had.
    expect(getItemByIdOrThrow(flow.value.steps, 'step1').value.next).toEqual([
      'step3'
    ]);
  });
});

describe('deleteFlowStep() closes the chain around the removed step', () => {
  test('deleting a step closes the chain (A -> B -> C, delete B, A -> C)', () => {
    const chainFlow: Flow = {
      id: 'flow-chain',
      name: 'Chain flow',
      steps: [
        {
          id: 'A',
          connectorId: 'connector1',
          direction: 'REQUEST',
          next: ['B']
        },
        {
          id: 'B',
          connectorId: 'connector2',
          direction: 'REQUEST',
          next: ['C']
        },
        { id: 'C', connectorId: 'connector1', direction: 'RESPONSE', next: [] }
      ]
    };

    const model = produce(modelFixture, (draft) => {
      draft.flows = [chainFlow];
    });

    const newState = deleteFlowStep(
      { flowId: 'flow-chain', stepId: 'B' },
      { model, scene }
    );

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow-chain');

    expect(
      flow.value.steps.map((step) => {
        return step.id;
      })
    ).toEqual(['A', 'C']);
    expect(getItemByIdOrThrow(flow.value.steps, 'A').value.next).toEqual(['C']);
  });

  test('deleting from a list flow leaves it a list flow', () => {
    const listFlow: Flow = {
      id: 'flow-list2',
      name: 'List flow',
      steps: [
        { id: 'step1', connectorId: 'connector1', direction: 'REQUEST' },
        { id: 'step2', connectorId: 'connector2', direction: 'REQUEST' },
        { id: 'step3', connectorId: 'connector1', direction: 'RESPONSE' }
      ]
    };

    const model = produce(modelFixture, (draft) => {
      draft.flows = [listFlow];
    });

    const newState = deleteFlowStep(
      { flowId: 'flow-list2', stepId: 'step2' },
      { model, scene }
    );

    const flow = getItemByIdOrThrow(newState.model.flows ?? [], 'flow-list2');

    expect(
      flow.value.steps.map((step) => {
        return step.id;
      })
    ).toEqual(['step1', 'step3']);
    expect(hasExplicitSuccessors(flow.value.steps)).toBe(false);
  });
});
