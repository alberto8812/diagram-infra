// Splits an item label into lines that fit under its icon, so long names
// wrap instead of spilling into the neighbouring items. SVG <text> does not
// wrap on its own, and measuring rendered text would tie this pure helper to
// the DOM, so the width budget is a character count: at the flat diagram's
// 12px label size an average glyph is ~6.5px, and 18 characters stay inside
// the 120px item cell.
//
// Words are kept whole where possible. A single word longer than a line is
// hard-split. Text beyond `maxLines` is cut and the last line ends with an
// ellipsis; the full name stays available in the item's <title> tooltip.
export const LABEL_MAX_CHARS_PER_LINE = 18;
export const LABEL_MAX_LINES = 3;
const ELLIPSIS = '…';

const splitLongWord = (word: string, maxChars: number): string[] => {
  const chunks: string[] = [];

  for (let start = 0; start < word.length; start += maxChars) {
    chunks.push(word.slice(start, start + maxChars));
  }

  return chunks;
};

export const wrapLabel = (
  label: string,
  maxChars: number = LABEL_MAX_CHARS_PER_LINE,
  maxLines: number = LABEL_MAX_LINES
): string[] => {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      return word.length > maxChars ? splitLongWord(word, maxChars) : [word];
    });

  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (current === '') {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  });

  if (current !== '') {
    lines.push(current);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] =
    last.length + ELLIPSIS.length <= maxChars
      ? `${last}${ELLIPSIS}`
      : `${last.slice(0, maxChars - ELLIPSIS.length)}${ELLIPSIS}`;

  return kept;
};
