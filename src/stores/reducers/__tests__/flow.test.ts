import { produce } from 'immer';
import { model as modelFixture } from 'src/fixtures/model';
import { Flow } from 'src/types';
import { getItemByIdOrThrow } from 'src/utils';
import * as reducers from 'src/stores/reducers';
import {
  createFlow,
  updateFlow,
  deleteFlow,
  createFlowStep,
  updateFlowStep,
  deleteFlowStep,
  reorderFlowSteps
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
