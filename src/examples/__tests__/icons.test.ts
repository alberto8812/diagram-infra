import { icons } from '../initialData';

describe('example icon set', () => {
  it('gives every icon a unique id', () => {
    const ids = icons.map((icon) => {
      return icon.id;
    });
    const duplicates = ids.filter((id, index) => {
      return ids.indexOf(id) !== index;
    });

    expect(duplicates).toEqual([]);
  });

  it('only loads icons over https or inline data URIs', () => {
    const insecure = icons.filter((icon) => {
      return !/^(https:|data:image\/)/.test(icon.url);
    });

    expect(insecure).toEqual([]);
  });

  it('includes the technology collections', () => {
    const collections = new Set(
      icons.map((icon) => {
        return icon.collection;
      })
    );

    expect([...collections]).toEqual(
      expect.arrayContaining([
        'runtimes',
        'frameworks',
        'apis',
        'data',
        'messaging',
        'identity',
        'networking',
        'platform',
        'observability',
        'ai'
      ])
    );
  });
});
