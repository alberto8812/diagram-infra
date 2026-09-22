import { catalog } from '../catalog';
import { costCatalogSchema } from '../types';

describe('the bundled cost catalog', () => {
  test('parses against costCatalogSchema (every entry has its required fields)', () => {
    const result = costCatalogSchema.safeParse(catalog);

    expect(result.success).toBe(true);
  });

  test('lastUpdated is a real, parseable date', () => {
    expect(Number.isNaN(new Date(catalog.lastUpdated).getTime())).toBe(false);
  });

  test('every region multiplier is a positive number', () => {
    Object.values(catalog.regions).forEach((region) => {
      expect(region.multiplier).toBeGreaterThan(0);
    });
  });

  test('every item price and storage rate is non-negative', () => {
    catalog.items.forEach((entry) => {
      expect(entry.monthlyUsd).toBeGreaterThanOrEqual(0);
    });
    catalog.storage.forEach((entry) => {
      expect(entry.usdPerGbMonth).toBeGreaterThanOrEqual(0);
    });
  });

  test('has no duplicate (kind, size, engine) item entries', () => {
    const keys = catalog.items.map((entry) => {
      return `${entry.kind}|${entry.size}|${entry.match?.engine ?? ''}`;
    });

    expect(new Set(keys).size).toBe(keys.length);
  });

  test('covers the documented common shapes: EC2, RDS (by engine), ElastiCache, ALB, NAT gateway', () => {
    const has = (kind: string, size: string, engine?: string) => {
      return catalog.items.some((entry) => {
        return (
          entry.kind === kind &&
          entry.size === size &&
          (engine === undefined || entry.match?.engine === engine)
        );
      });
    };

    expect(has('service', 't3.medium')).toBe(true);
    expect(has('service', 'm5.large')).toBe(true);
    expect(has('database', 'db.t3.medium', 'mysql')).toBe(true);
    expect(has('database', 'db.t3.medium', 'postgres')).toBe(true);
    expect(has('cache', 'cache.t3.medium')).toBe(true);
    expect(has('loadBalancer', 'application')).toBe(true);
    expect(has('gateway', 'nat')).toBe(true);

    expect(
      catalog.storage.some((entry) => {
        return entry.kind === 'storage';
      })
    ).toBe(true);
    expect(
      catalog.storage.some((entry) => {
        return entry.kind === 'service';
      })
    ).toBe(true);
  });
});
