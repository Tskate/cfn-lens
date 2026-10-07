// TextEncoder is a Web/Node API, not ECMAScript, so core (no DOM/Node types) counts UTF-8 bytes itself.
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  // for…of iterates code points, so a surrogate pair (e.g. an emoji) is one step, not two.
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint < 0x80) bytes += 1;
    else if (codePoint < 0x800) bytes += 2;
    else if (codePoint < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
