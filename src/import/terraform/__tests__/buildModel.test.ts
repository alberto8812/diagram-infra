import * as fs from 'fs';
import * as path from 'path';
import { modelSchema } from 'src/schemas';
import { getItemZones } from 'src/utils/containment';
import { buildTerraformModel } from '../buildModel';
import { TerraformShowJson } from '../types';

const loadFixture = (name: string): TerraformShowJson => {
  const raw = fs.readFileSync(
    path.join(__dirname, '..', '__fixtures__', name),
    'utf8'
  );
  return JSON.parse(raw) as TerraformShowJson;
};

describe('buildTerraformModel() — state fixture', () => {
  const { model, summary } = buildTerraformModel(
    loadFixture('state-basic.json'),
    'imported-state'
  );

  test('produces a Model that passes modelSchema', () => {
    const result = modelSchema.safeParse(model);
    expect(result.success).toBe(true);
  });

  test('has one view with the mapped items, rectangles and no connectors', () => {
    expect(model.views).toHaveLength(1);
    const [view] = model.views;

    expect(
      view.items
        .map((i) => {
          return i.id;
        })
        .sort()
    ).toStrictEqual(
      [
        'aws_instance.web',
        'aws_db_instance.main',
        'aws_s3_bucket.assets',
        'aws_lb.main'
      ].sort()
    );
    expect(view.rectangles).toHaveLength(4); // vpc + 2 subnets + shared az
    expect(view.connectors).toStrictEqual([]);
  });

  test('containment utils report the intended zone nesting for the instance', () => {
    const [view] = model.views;
    const zoneIds = getItemZones(view, 'aws_instance.web').map((z) => {
      return z.id;
    });

    expect(zoneIds).toStrictEqual([
      'aws_subnet.public',
      'aws_vpc.main:az:us-east-1a',
      'aws_vpc.main'
    ]);
  });

  test('reports the import summary', () => {
    expect(summary.skippedTypes).toStrictEqual(['aws_iam_role']);
    expect(summary.dataResources).toBe(1);
  });
});

describe('buildTerraformModel() — plan fixture (modules)', () => {
  const { model } = buildTerraformModel(
    loadFixture('plan-modules.json'),
    'imported-plan'
  );

  test('produces a Model that passes modelSchema', () => {
    const result = modelSchema.safeParse(model);
    expect(result.success).toBe(true);
  });

  test('nests the module-scoped subnet inside its module -> vpc -> az chain', () => {
    const [view] = model.views;
    const zoneIds = getItemZones(
      view,
      'module.network.aws_instance.bastion'
    ).map((z) => {
      return z.id;
    });

    expect(zoneIds).toStrictEqual(['module:network']);
  });

  test('has one connector between the lambda and the db it depends on', () => {
    const [view] = model.views;
    expect(view.connectors).toHaveLength(1);

    const [connector] = view.connectors ?? [];
    const itemIds = connector.anchors
      .map((a) => {
        return a.ref.item;
      })
      .filter((id): id is string => {
        return id !== undefined;
      })
      .sort();

    expect(itemIds).toStrictEqual(
      ['aws_db_instance.main', 'aws_lambda_function.api'].sort()
    );
  });
});
