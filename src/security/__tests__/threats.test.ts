import { Connector, ModelItem, Rectangle, View } from 'src/types';
import { generateThreats, generateThreatsForView } from '../threats';

const rect = (
  overrides: Partial<Rectangle> & Pick<Rectangle, 'id'>
): Rectangle => {
  return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, ...overrides };
};

const item = (
  overrides: Partial<ModelItem> & Pick<ModelItem, 'id'>
): ModelItem => {
  return { name: overrides.id, ...overrides };
};

const view = (overrides: Partial<View> & Pick<View, 'id'>): View => {
  return { name: 'Test view', items: [], ...overrides };
};

// One subnet (0,0)-(5,5) so a connector between an item inside it and an
// item outside it always crosses a trust boundary.
const subnet = rect({
  id: 'subnet1',
  zone: 'subnet',
  from: { x: 0, y: 0 },
  to: { x: 5, y: 5 }
});

const threatsFor = (
  items: ModelItem[],
  rectangles: Rectangle[],
  viewItems: View['items'],
  connectors: Connector[] = []
) => {
  const testView = view({
    id: 'v1',
    rectangles,
    items: viewItems,
    connectors
  });

  return generateThreatsForView({ items, views: [testView] }, testView);
};

describe('generateThreatsForView() / generateThreats()', () => {
  test('an item without a kind produces no threats', () => {
    const noKind = item({ id: 'i1' });

    const threats = threatsFor(
      [noKind],
      [],
      [{ id: 'i1', tile: { x: 0, y: 0 } }]
    );

    expect(threats).toStrictEqual([]);
  });

  test('an external entity (user/external kind) gets S and R, both unknown', () => {
    const user = item({ id: 'u1', kind: 'user' });

    const threats = threatsFor(
      [user],
      [],
      [{ id: 'u1', tile: { x: 0, y: 0 } }]
    );
    const categories = threats.map((threat) => {
      return threat.category;
    });

    expect(categories.sort()).toStrictEqual(['R', 'S']);
    threats.forEach((threat) => {
      expect(threat.status).toBe('unknown');
      expect(threat.targetType).toBe('ITEM');
      expect(threat.targetId).toBe('u1');
      expect(threat.viewId).toBe('v1');
      expect(threat.id).toBe(`v1:ITEM:u1:${threat.category}`);
    });
  });

  describe('data store (database/cache/storage/queue) — Information disclosure (I)', () => {
    test('confidential + encryptedAtRest true → mitigated', () => {
      const db = item({
        id: 'db1',
        kind: 'database',
        dataClassification: 'confidential',
        encryptedAtRest: true
      });

      const threats = threatsFor(
        [db],
        [],
        [{ id: 'db1', tile: { x: 0, y: 0 } }]
      );
      const iThreat = threats.find((threat) => {
        return threat.category === 'I';
      });

      expect(iThreat?.status).toBe('mitigated');
    });

    test('restricted + encryptedAtRest false → open', () => {
      const db = item({
        id: 'db1',
        kind: 'database',
        dataClassification: 'restricted',
        encryptedAtRest: false
      });

      const threats = threatsFor(
        [db],
        [],
        [{ id: 'db1', tile: { x: 0, y: 0 } }]
      );
      const iThreat = threats.find((threat) => {
        return threat.category === 'I';
      });

      expect(iThreat?.status).toBe('open');
    });

    test('restricted + encryptedAtRest unset → open', () => {
      const db = item({
        id: 'db1',
        kind: 'database',
        dataClassification: 'restricted'
      });

      const threats = threatsFor(
        [db],
        [],
        [{ id: 'db1', tile: { x: 0, y: 0 } }]
      );
      const iThreat = threats.find((threat) => {
        return threat.category === 'I';
      });

      expect(iThreat?.status).toBe('open');
    });

    test('no classification set → unknown regardless of encryptedAtRest', () => {
      const db = item({ id: 'db1', kind: 'database', encryptedAtRest: true });

      const threats = threatsFor(
        [db],
        [],
        [{ id: 'db1', tile: { x: 0, y: 0 } }]
      );
      const iThreat = threats.find((threat) => {
        return threat.category === 'I';
      });

      expect(iThreat?.status).toBe('unknown');
    });

    test('public/internal classification → unknown', () => {
      const db = item({
        id: 'db1',
        kind: 'database',
        dataClassification: 'internal'
      });

      const threats = threatsFor(
        [db],
        [],
        [{ id: 'db1', tile: { x: 0, y: 0 } }]
      );
      const iThreat = threats.find((threat) => {
        return threat.category === 'I';
      });

      expect(iThreat?.status).toBe('unknown');
    });

    test('emits T, R, I, D — exactly the data-store STRIDE-per-element set', () => {
      const db = item({ id: 'db1', kind: 'cache' });

      const threats = threatsFor(
        [db],
        [],
        [{ id: 'db1', tile: { x: 0, y: 0 } }]
      );
      const categories = threats.map((threat) => {
        return threat.category;
      });

      expect(categories.sort()).toStrictEqual(['D', 'I', 'R', 'T']);
      expect(
        threats
          .filter((t) => {
            return t.category !== 'I';
          })
          .every((t) => {
            return t.status === 'unknown';
          })
      ).toBe(true);
    });
  });

  describe('process — Spoofing (S) / Elevation of privilege (E)', () => {
    const service = item({ id: 'svc1', kind: 'service', internetFacing: true });
    const client = item({ id: 'client1', kind: 'service' });

    test('internetFacing with an unauthenticated inbound flow crossing a boundary → open', () => {
      const connector: Connector = {
        id: 'c1',
        auth: 'none',
        anchors: [
          { id: 'a1', ref: { item: 'client1' } },
          { id: 'a2', ref: { item: 'svc1' } }
        ]
      };

      const threats = threatsFor(
        [service, client],
        [subnet],
        [
          { id: 'client1', tile: { x: 10, y: 10 } },
          { id: 'svc1', tile: { x: 1, y: 1 } }
        ],
        [connector]
      );

      const s = threats.find((t) => {
        return t.targetId === 'svc1' && t.category === 'S';
      });
      const e = threats.find((t) => {
        return t.targetId === 'svc1' && t.category === 'E';
      });

      expect(s?.status).toBe('open');
      expect(e?.status).toBe('open');
    });

    test('internetFacing with every crossing inbound flow authenticated → mitigated', () => {
      const connector: Connector = {
        id: 'c1',
        auth: 'iam',
        anchors: [
          { id: 'a1', ref: { item: 'client1' } },
          { id: 'a2', ref: { item: 'svc1' } }
        ]
      };

      const threats = threatsFor(
        [service, client],
        [subnet],
        [
          { id: 'client1', tile: { x: 10, y: 10 } },
          { id: 'svc1', tile: { x: 1, y: 1 } }
        ],
        [connector]
      );

      const s = threats.find((t) => {
        return t.targetId === 'svc1' && t.category === 'S';
      });
      const e = threats.find((t) => {
        return t.targetId === 'svc1' && t.category === 'E';
      });

      expect(s?.status).toBe('mitigated');
      expect(e?.status).toBe('mitigated');
    });

    test('not internetFacing → unknown regardless of inbound auth', () => {
      const notFacing = item({ id: 'svc2', kind: 'service' });
      const connector: Connector = {
        id: 'c1',
        auth: 'none',
        anchors: [
          { id: 'a1', ref: { item: 'client1' } },
          { id: 'a2', ref: { item: 'svc2' } }
        ]
      };

      const threats = threatsFor(
        [notFacing, client],
        [subnet],
        [
          { id: 'client1', tile: { x: 10, y: 10 } },
          { id: 'svc2', tile: { x: 1, y: 1 } }
        ],
        [connector]
      );

      const s = threats.find((t) => {
        return t.targetId === 'svc2' && t.category === 'S';
      });

      expect(s?.status).toBe('unknown');
    });

    test('emits S, T, R, I, D, E — the full process STRIDE-per-element set', () => {
      const threats = threatsFor(
        [client],
        [],
        [{ id: 'client1', tile: { x: 0, y: 0 } }]
      );
      const categories = threats
        .map((t) => {
          return t.category;
        })
        .sort();

      expect(categories).toStrictEqual(['D', 'E', 'I', 'R', 'S', 'T']);
    });
  });

  describe('data flow (connector) — Tampering (T) / Information disclosure (I)', () => {
    const inside = item({ id: 'inside', kind: 'service' });
    const outside = item({ id: 'outside', kind: 'service' });

    const crossingConnector = (overrides: Partial<Connector>): Connector => {
      return {
        id: 'c1',
        anchors: [
          { id: 'a1', ref: { item: 'outside' } },
          { id: 'a2', ref: { item: 'inside' } }
        ],
        ...overrides
      };
    };

    const viewItems: View['items'] = [
      { id: 'inside', tile: { x: 1, y: 1 } },
      { id: 'outside', tile: { x: 20, y: 20 } }
    ];

    test('HTTPS crossing a boundary → T and I mitigated', () => {
      const connector = crossingConnector({ protocol: 'HTTPS' });

      const threats = threatsFor([inside, outside], [subnet], viewItems, [
        connector
      ]);
      const flow = threats.filter((t) => {
        return t.targetType === 'CONNECTOR';
      });

      expect(
        flow.find((t) => {
          return t.category === 'T';
        })?.status
      ).toBe('mitigated');
      expect(
        flow.find((t) => {
          return t.category === 'I';
        })?.status
      ).toBe('mitigated');
      expect(
        flow.find((t) => {
          return t.category === 'D';
        })?.status
      ).toBe('unknown');
    });

    test('plain HTTP crossing a boundary → T and I open', () => {
      const connector = crossingConnector({ protocol: 'HTTP' });

      const threats = threatsFor([inside, outside], [subnet], viewItems, [
        connector
      ]);
      const flow = threats.filter((t) => {
        return t.targetType === 'CONNECTOR';
      });

      expect(
        flow.find((t) => {
          return t.category === 'T';
        })?.status
      ).toBe('open');
      expect(
        flow.find((t) => {
          return t.category === 'I';
        })?.status
      ).toBe('open');
    });

    test('an undetermined protocol crossing a boundary → unknown', () => {
      const connector = crossingConnector({ protocol: 'gRPC' });

      const threats = threatsFor([inside, outside], [subnet], viewItems, [
        connector
      ]);
      const flow = threats.filter((t) => {
        return t.targetType === 'CONNECTOR';
      });

      expect(
        flow.find((t) => {
          return t.category === 'T';
        })?.status
      ).toBe('unknown');
      expect(
        flow.find((t) => {
          return t.category === 'I';
        })?.status
      ).toBe('unknown');
    });

    test('a connector that never crosses a trust boundary produces no data-flow threats', () => {
      const connector: Connector = {
        id: 'c1',
        protocol: 'HTTP',
        anchors: [
          { id: 'a1', ref: { item: 'inside' } },
          { id: 'a2', ref: { item: 'inside' } }
        ]
      };

      const threats = threatsFor(
        [inside],
        [subnet],
        [{ id: 'inside', tile: { x: 1, y: 1 } }],
        [connector]
      );

      expect(
        threats.filter((t) => {
          return t.targetType === 'CONNECTOR';
        })
      ).toStrictEqual([]);
    });
  });

  test('generateThreats() concatenates every view in model.views order', () => {
    const a = item({ id: 'a1', kind: 'user' });
    const b = item({ id: 'b1', kind: 'user' });

    const viewA = view({
      id: 'va',
      items: [{ id: 'a1', tile: { x: 0, y: 0 } }]
    });
    const viewB = view({
      id: 'vb',
      items: [{ id: 'b1', tile: { x: 0, y: 0 } }]
    });

    const threats = generateThreats({
      items: [a, b],
      views: [viewA, viewB]
    });

    expect(
      threats.every((t) => {
        return t.viewId === 'va' || t.viewId === 'vb';
      })
    ).toBe(true);
    expect(threats[0].viewId).toBe('va');
    expect(threats[threats.length - 1].viewId).toBe('vb');
  });
});
