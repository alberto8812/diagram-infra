import { Model, ModelItem, View } from 'src/types';
import { model as fixtureModel } from 'src/fixtures/model';
import { lintDiagram, lintView } from '../engine';
import { RULES } from '../catalog';

const item = (
  overrides: Partial<ModelItem> & Pick<ModelItem, 'id'>
): ModelItem => {
  return {
    name: overrides.id,
    ...overrides
  };
};

const view = (overrides: Partial<View> & Pick<View, 'id'>): View => {
  return {
    name: 'Test view',
    items: [],
    ...overrides
  };
};

describe('lintDiagram() / lintView()', () => {
  test('the existing model fixture (no zones, no typed metadata) has no issues', () => {
    expect(lintDiagram(fixtureModel)).toStrictEqual([]);
  });

  test('runs rules in catalog order within a view', () => {
    // A single prod database with no owner, in no zone, triggers both
    // prod-without-owner (rule 3) and missing-environment would not (it has
    // an environment) — use a plain kind-only node for missing-environment
    // (rule 8) and a prod/no-owner database (rule 3) so both fire in one
    // view, in catalog order.
    const items: ModelItem[] = [
      item({ id: 'db1', kind: 'database', environment: 'prod' }),
      item({ id: 'svc1', kind: 'service' })
    ];

    const testView = view({
      id: 'v1',
      items: [
        { id: 'db1', tile: { x: 0, y: 0 } },
        { id: 'svc1', tile: { x: 5, y: 5 } }
      ]
    });

    const issues = lintView({ items, views: [testView] }, testView);
    const ruleIds = issues.map((issue) => {
      return issue.ruleId;
    });

    expect(ruleIds).toStrictEqual([
      'prod-without-owner',
      'missing-environment'
    ]);

    // The catalog order guarantee: prod-without-owner is earlier in RULES
    // than missing-environment, and the output preserves that.
    const prodWithoutOwnerIndex = RULES.findIndex((rule) => {
      return rule.id === 'prod-without-owner';
    });
    const missingEnvironmentIndex = RULES.findIndex((rule) => {
      return rule.id === 'missing-environment';
    });
    expect(prodWithoutOwnerIndex).toBeLessThan(missingEnvironmentIndex);
  });

  test('aggregates issues across every view, in view order', () => {
    const items: ModelItem[] = [
      item({ id: 'svc1', kind: 'service' }),
      item({ id: 'svc2', kind: 'service' })
    ];

    const viewA = view({
      id: 'viewA',
      items: [{ id: 'svc1', tile: { x: 0, y: 0 } }]
    });
    const viewB = view({
      id: 'viewB',
      items: [{ id: 'svc2', tile: { x: 0, y: 0 } }]
    });

    const model: Pick<Model, 'items' | 'views'> = {
      items,
      views: [viewA, viewB]
    };

    const issues = lintDiagram(model);

    expect(
      issues.map((issue) => {
        return `${issue.viewId}:${issue.ruleId}:${issue.targets[0].id}`;
      })
    ).toStrictEqual([
      'viewA:missing-environment:svc1',
      'viewB:missing-environment:svc2'
    ]);
  });
});
