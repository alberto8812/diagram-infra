import { rectangleSchema } from '../rectangle';

describe('rectangleSchema (P0 containment zones)', () => {
  test('an old rectangle with no zone fields is still valid', () => {
    const result = rectangleSchema.safeParse({
      id: 'rect1',
      color: 'color1',
      from: { x: 0, y: 0 },
      to: { x: 2, y: 2 }
    });

    expect(result.success).toBe(true);
  });

  test('a rectangle with a valid zone kind, name and visibility is valid', () => {
    const result = rectangleSchema.safeParse({
      id: 'rect1',
      from: { x: 0, y: 0 },
      to: { x: 2, y: 2 },
      zone: 'subnet',
      name: 'Private subnet A',
      visibility: 'private'
    });

    expect(result.success).toBe(true);
  });

  test('a zone with no name/visibility is still valid (both optional)', () => {
    const result = rectangleSchema.safeParse({
      id: 'rect1',
      from: { x: 0, y: 0 },
      to: { x: 2, y: 2 },
      zone: 'vpc'
    });

    expect(result.success).toBe(true);
  });

  test('an invalid zone kind fails validation', () => {
    const result = rectangleSchema.safeParse({
      id: 'rect1',
      from: { x: 0, y: 0 },
      to: { x: 2, y: 2 },
      zone: 'datacenter'
    });

    expect(result.success).toBe(false);
  });

  test('an invalid visibility value fails validation', () => {
    const result = rectangleSchema.safeParse({
      id: 'rect1',
      from: { x: 0, y: 0 },
      to: { x: 2, y: 2 },
      zone: 'subnet',
      visibility: 'internal'
    });

    expect(result.success).toBe(false);
  });

  test('a name over the shared label max length fails validation', () => {
    const result = rectangleSchema.safeParse({
      id: 'rect1',
      from: { x: 0, y: 0 },
      to: { x: 2, y: 2 },
      zone: 'vpc',
      name: 'a'.repeat(61)
    });

    expect(result.success).toBe(false);
  });
});
