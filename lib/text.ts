/**
 * True if the text has a control character (code below 32, or 127).
 * `allowNewlines` lets line breaks (10, 13) through, for multi-line fields like a bio.
 */
export function hasControlChar(value: string, options: { allowNewlines?: boolean } = {}): boolean {
  return [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    if (options.allowNewlines && (code === 10 || code === 13)) return false;
    return code < 32 || code === 127;
  });
}
