import { produce } from 'immer';
import { model as modelFixture } from 'src/fixtures/model';
import { getItemByIdOrThrow } from 'src/utils';
import { createView, updateView, deleteView } from '../view';

const scene = {
  connectors: {},
  textBoxes: {}
};

describe('View reducers work correctly', () => {
  test('a new view is created with the given name', () => {
    const newState = createView(
      { name: 'Network' },
      { viewId: 'newView1', state: { model: modelFixture, scene } }
    );

    expect(newState.model.views).toHaveLength(modelFixture.views.length + 1);

    const created = getItemByIdOrThrow(newState.model.views, 'newView1');

    expect(created.value.name).toBe('Network');
    expect(created.value.items).toStrictEqual([]);
  });

  test('a new view falls back to the default name when none is given', () => {
    const newState = createView(
      {},
      { viewId: 'newView2', state: { model: modelFixture, scene } }
    );

    const created = getItemByIdOrThrow(newState.model.views, 'newView2');

    expect(created.value.name).toBe('Untitled view');
  });

  test('an existing view is renamed correctly', () => {
    const existingViewId = modelFixture.views[0].id;

    const newState = updateView(
      { name: 'Renamed view' },
      { viewId: existingViewId, state: { model: modelFixture, scene } }
    );

    const updated = getItemByIdOrThrow(newState.model.views, existingViewId);

    expect(updated.value.name).toBe('Renamed view');
  });

  test('a view is deleted correctly', () => {
    const modelWithTwoViews = produce(modelFixture, (draft) => {
      draft.views.push({ id: 'view2', name: 'View 2', items: [] });
    });

    const newState = deleteView({
      viewId: 'view2',
      state: { model: modelWithTwoViews, scene }
    });

    expect(
      newState.model.views.find((v) => {
        return v.id === 'view2';
      })
    ).toBeUndefined();
    expect(newState.model.views).toHaveLength(modelFixture.views.length);
  });
});
