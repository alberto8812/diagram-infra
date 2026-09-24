import { wrapLabel, LABEL_MAX_CHARS_PER_LINE } from '../wrapLabel';

describe('wrapLabel', () => {
  test('a short label stays on one line', () => {
    expect(wrapLabel('ATC Tower Billing')).toEqual(['ATC Tower Billing']);
  });

  test('a long label wraps at word boundaries', () => {
    expect(wrapLabel('Public address (PA) system')).toEqual([
      'Public address',
      '(PA) system'
    ]);
  });

  test('no line is longer than the character budget', () => {
    const lines = wrapLabel(
      'Flight Information Display System (FIDS) for all terminals'
    );

    lines.forEach((line) => {
      expect(line.length).toBeLessThanOrEqual(LABEL_MAX_CHARS_PER_LINE);
    });
  });

  test('text beyond the line limit is cut with an ellipsis', () => {
    const lines = wrapLabel(
      'Common use services (self-service check-in systems and kiosks)'
    );

    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith('…')).toBe(true);
    expect(lines[2].length).toBeLessThanOrEqual(LABEL_MAX_CHARS_PER_LINE);
  });

  test('a single word longer than a line is hard-split', () => {
    expect(wrapLabel('Supercalifragilisticexpialidocious', 10, 5)).toEqual([
      'Supercalif',
      'ragilistic',
      'expialidoc',
      'ious'
    ]);
  });

  test('extra whitespace is collapsed and a blank label gives no lines', () => {
    expect(wrapLabel('  Staff   management ')).toEqual(['Staff management']);
    expect(wrapLabel('   ')).toEqual([]);
  });
});
