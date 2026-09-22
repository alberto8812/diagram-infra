import { readFileSync } from 'fs';
import { join } from 'path';
import { modelSchema } from '../model';
import { icons } from '../../examples/initialData';

// The diagrams under diagrams/ are saved with `icons: []` (see persistence.ts), because
// the app supplies the icon packs when it loads them. Validating a saved file therefore
// has to put the packs back, otherwise every item reports a missing icon.
const loadDiagram = (name: string) => {
  const raw = readFileSync(join(__dirname, '../../../diagrams', name), 'utf8');

  return { ...JSON.parse(raw), icons };
};

describe('committed diagrams', () => {
  test('infra.json parses against the model schema', () => {
    const result = modelSchema.safeParse(loadDiagram('infra.json'));

    if (!result.success) {
      throw new Error(
        JSON.stringify(result.error.issues.slice(0, 10), null, 2)
      );
    }

    expect(result.success).toBe(true);
  });

  test('every flow step in infra.json points at a connector that exists', () => {
    const diagram = loadDiagram('infra.json');
    const connectorIds = new Set(
      diagram.views.flatMap((view: { connectors?: { id: string }[] }) => {
        return (view.connectors ?? []).map((connector) => {
          return connector.id;
        });
      })
    );

    const dangling = diagram.flows.flatMap(
      (flow: { id: string; steps: { id: string; connectorId: string }[] }) => {
        return flow.steps
          .filter((step) => {
            return !connectorIds.has(step.connectorId);
          })
          .map((step) => {
            return `${flow.id}/${step.id} -> ${step.connectorId}`;
          });
      }
    );

    expect(dangling).toEqual([]);
  });
});
