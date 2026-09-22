import { blockKey, parseAddress, parseReferenceToResource } from '../address';

describe('parseAddress()', () => {
  test('parses a simple root resource address', () => {
    expect(parseAddress('aws_instance.web')).toStrictEqual({
      modulePath: [],
      type: 'aws_instance',
      name: 'web',
      index: undefined
    });
  });

  test('parses a counted/for_each resource address', () => {
    expect(parseAddress('aws_subnet.public[0]')).toStrictEqual({
      modulePath: [],
      type: 'aws_subnet',
      name: 'public',
      index: '0'
    });

    expect(parseAddress('aws_subnet.public["a"]')).toStrictEqual({
      modulePath: [],
      type: 'aws_subnet',
      name: 'public',
      index: '"a"'
    });
  });

  test('parses a single module-nested address', () => {
    expect(parseAddress('module.network.aws_vpc.main')).toStrictEqual({
      modulePath: ['network'],
      type: 'aws_vpc',
      name: 'main',
      index: undefined
    });
  });

  test('parses a doubly module-nested, indexed address', () => {
    expect(
      parseAddress('module.network.module.subnets.aws_subnet.public[0]')
    ).toStrictEqual({
      modulePath: ['network', 'subnets'],
      type: 'aws_subnet',
      name: 'public',
      index: '0'
    });
  });

  test('parses a module-nested address with an indexed module instance', () => {
    expect(parseAddress('module.network[0].aws_vpc.main')).toStrictEqual({
      modulePath: ['network'],
      type: 'aws_vpc',
      name: 'main',
      index: undefined
    });
  });

  test('is undefined for a string that is not a resource address', () => {
    expect(parseAddress('not an address')).toBeUndefined();
    expect(parseAddress('')).toBeUndefined();
  });
});

describe('blockKey()', () => {
  test('joins module path, type and name, ignoring index', () => {
    expect(blockKey(['network'], 'aws_subnet', 'public')).toBe(
      'network|aws_subnet|public'
    );
    expect(blockKey([], 'aws_vpc', 'main')).toBe('|aws_vpc|main');
  });
});

describe('parseReferenceToResource()', () => {
  test('resolves a plain resource reference', () => {
    expect(parseReferenceToResource('aws_vpc.main.id')).toStrictEqual({
      type: 'aws_vpc',
      name: 'main'
    });
  });

  test('resolves a resource reference with no trailing attribute', () => {
    expect(parseReferenceToResource('aws_security_group.app')).toStrictEqual({
      type: 'aws_security_group',
      name: 'app'
    });
  });

  test('is undefined for a module output reference', () => {
    expect(parseReferenceToResource('module.network.vpc_id')).toBeUndefined();
  });

  test('is undefined for var/local/data/each/count references', () => {
    expect(parseReferenceToResource('var.region')).toBeUndefined();
    expect(parseReferenceToResource('local.name')).toBeUndefined();
    expect(parseReferenceToResource('data.aws_ami.ubuntu.id')).toBeUndefined();
    expect(parseReferenceToResource('each.value')).toBeUndefined();
    expect(parseReferenceToResource('count.index')).toBeUndefined();
  });
});
