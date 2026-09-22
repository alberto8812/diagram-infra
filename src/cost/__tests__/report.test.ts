import { buildCostReportJson, buildCostReportMarkdown } from '../report';
import { DiagramCostEstimate } from '../types';

const estimate: DiagramCostEstimate = {
  currency: 'USD',
  lastUpdated: '2026-01-01',
  totalMonthlyUsd: 42,
  hasApproximate: true,
  perView: [
    {
      id: 'view-1',
      label: 'Main',
      monthlyUsd: 42,
      itemCount: 1,
      hasApproximate: true
    }
  ],
  perZone: [],
  perEnvironment: [
    {
      id: 'prod',
      label: 'prod',
      monthlyUsd: 42,
      itemCount: 1,
      hasApproximate: true
    }
  ],
  unpriced: [{ itemId: 'x', itemName: 'Mystery box', reasons: ['no match'] }]
};

describe('buildCostReportMarkdown()', () => {
  test('includes the total, sections and unpriced nodes', () => {
    const markdown = buildCostReportMarkdown({
      generatedAt: '2026-01-02T00:00:00.000Z',
      diagramTitle: 'infra',
      estimate
    });

    expect(markdown).toContain('# Cost report — infra');
    expect(markdown).toContain('USD 42.00');
    expect(markdown).toContain('## By view');
    expect(markdown).toContain('## By environment');
    expect(markdown).toContain('Mystery box');
  });
});

describe('buildCostReportJson()', () => {
  test('round-trips the estimate as JSON', () => {
    const json = buildCostReportJson({
      generatedAt: '2026-01-02T00:00:00.000Z',
      estimate
    });
    const parsed = JSON.parse(json);

    expect(parsed.totalMonthlyUsd).toBe(42);
    expect(parsed.unpriced).toHaveLength(1);
    expect(parsed.diagramTitle).toBe('Untitled diagram');
  });
});
