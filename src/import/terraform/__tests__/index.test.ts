import { parseTerraformImportSource } from '../index';
import { TerraformImportError } from '../resolve';
import { buildTerraformModel } from '../buildModel';

describe('parseTerraformImportSource()', () => {
  test('throws a clean TerraformImportError for invalid JSON', () => {
    expect(() => {
      parseTerraformImportSource('{not valid json');
    }).toThrow(TerraformImportError);
  });

  test('throws a clean TerraformImportError for a top-level array', () => {
    expect(() => {
      parseTerraformImportSource('[]');
    }).toThrow(TerraformImportError);
  });

  test('throws a clean TerraformImportError for a top-level primitive', () => {
    expect(() => {
      parseTerraformImportSource('42');
    }).toThrow(TerraformImportError);
    expect(() => {
      parseTerraformImportSource('"a string"');
    }).toThrow(TerraformImportError);
    expect(() => {
      parseTerraformImportSource('null');
    }).toThrow(TerraformImportError);
  });

  test('accepts a well-formed document', () => {
    const doc = parseTerraformImportSource(
      JSON.stringify({ values: { root_module: { resources: [] } } })
    );
    expect(doc).toStrictEqual({ values: { root_module: { resources: [] } } });
  });
});

describe('the full parse -> build pipeline on malformed shapes', () => {
  test('throws a clean TerraformImportError, never a raw TypeError, when resources is not an array', () => {
    const doc = parseTerraformImportSource(
      JSON.stringify({
        values: { root_module: { resources: 'not-an-array' } }
      })
    );

    expect(() => {
      buildTerraformModel(doc, 'test');
    }).toThrow(TerraformImportError);
  });

  test('throws a clean TerraformImportError, never a raw TypeError, when child_modules is not an array', () => {
    const doc = parseTerraformImportSource(
      JSON.stringify({
        values: {
          root_module: { resources: [], child_modules: { oops: true } }
        }
      })
    );

    expect(() => {
      buildTerraformModel(doc, 'test');
    }).toThrow(TerraformImportError);
  });
});
