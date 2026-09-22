import { flowStepSchema } from '../flow';

describe('flowStepSchema (roadmap item 4: next / outcome)', () => {
  test('a step with next and outcome parses successfully, and the parsed output still contains both fields with the same values', () => {
    const result = flowStepSchema.safeParse({
      id: 'step1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: ['step2', 'step3'],
      outcome: 'FAILURE'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.next).toStrictEqual(['step2', 'step3']);
      expect(result.data.outcome).toBe('FAILURE');
    }
  });

  test('a step with neither next nor outcome still parses (backward compatibility)', () => {
    const result = flowStepSchema.safeParse({
      id: 'step1',
      connectorId: 'conn1',
      direction: 'REQUEST'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.next).toBeUndefined();
      expect(result.data.outcome).toBeUndefined();
    }
  });

  test('an unknown outcome value is rejected', () => {
    const result = flowStepSchema.safeParse({
      id: 'step1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      outcome: 'PENDING'
    });

    expect(result.success).toBe(false);
  });

  test('a next entry that is not a valid id is rejected', () => {
    const result = flowStepSchema.safeParse({
      id: 'step1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: [123]
    });

    expect(result.success).toBe(false);
  });
});
