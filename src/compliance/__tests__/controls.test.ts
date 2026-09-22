import { Issue } from 'src/rules/types';
import { Threat } from 'src/security/threats';
import { CONTROLS, mapFindingsToControls } from '../controls';

const issue = (overrides: Partial<Issue> & Pick<Issue, 'ruleId'>): Issue => {
  return {
    severity: 'error',
    message: 'test issue',
    viewId: 'v1',
    targets: [{ type: 'ITEM', id: 'i1' }],
    ...overrides
  };
};

const threat = (
  overrides: Partial<Threat> & Pick<Threat, 'category'>
): Threat => {
  return {
    id: `v1:ITEM:i1:${overrides.category}`,
    targetType: 'ITEM',
    targetId: 'i1',
    viewId: 'v1',
    title: 'test threat',
    description: 'test threat description',
    status: 'open',
    mitigationHint: 'do something',
    ...overrides
  };
};

describe('mapFindingsToControls()', () => {
  test('returns every control in CONTROLS, even with no findings', () => {
    const mappings = mapFindingsToControls([], []);

    expect(mappings).toHaveLength(CONTROLS.length);
    mappings.forEach((mapping) => {
      expect(mapping.findings).toStrictEqual([]);
    });
  });

  test('a known rule id contributes a finding to its mapped controls', () => {
    const mappings = mapFindingsToControls(
      [issue({ ruleId: 'sensitive-datastore-unencrypted' })],
      []
    );

    const pci35 = mappings.find((m) => {
      return m.control.framework === 'PCI_DSS' && m.control.controlId === '3.5';
    });

    expect(pci35?.findings).toHaveLength(1);
    expect(pci35?.findings[0]).toMatchObject({
      source: 'rule',
      origin: 'sensitive-datastore-unencrypted',
      viewId: 'v1'
    });
  });

  test('an unknown rule id contributes no findings', () => {
    const mappings = mapFindingsToControls(
      [issue({ ruleId: 'not-a-real-rule' })],
      []
    );

    mappings.forEach((mapping) => {
      expect(mapping.findings).toStrictEqual([]);
    });
  });

  test('an open threat contributes a finding to its category-mapped controls', () => {
    const mappings = mapFindingsToControls([], [threat({ category: 'I' })]);

    const iso824 = mappings.find((m) => {
      return (
        m.control.framework === 'ISO27001' && m.control.controlId === '8.24'
      );
    });

    expect(iso824?.findings).toHaveLength(1);
    expect(iso824?.findings[0]).toMatchObject({
      source: 'threat',
      origin: 'I'
    });
  });

  test('a mitigated or unknown threat contributes no findings', () => {
    const mappings = mapFindingsToControls(
      [],
      [
        threat({ category: 'I', status: 'mitigated' }),
        threat({ category: 'S', status: 'unknown' })
      ]
    );

    mappings.forEach((mapping) => {
      expect(mapping.findings).toStrictEqual([]);
    });
  });

  test('findings from issues and threats accumulate on a shared control', () => {
    const mappings = mapFindingsToControls(
      [issue({ ruleId: 'sensitive-flow-unencrypted' })],
      [threat({ category: 'I' })]
    );

    const iso824 = mappings.find((m) => {
      return (
        m.control.framework === 'ISO27001' && m.control.controlId === '8.24'
      );
    });

    expect(iso824?.findings).toHaveLength(2);
    expect(
      iso824?.findings
        .map((f) => {
          return f.source;
        })
        .sort()
    ).toStrictEqual(['rule', 'threat']);
  });
});
