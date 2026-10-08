export interface TypingSegment { text: string; gold?: boolean; flare?: boolean }
export interface TypingChar { ch: string; i: number; gold: boolean; flare: boolean }
export interface TypingLayout { text: string; total: number; words: TypingChar[][]; flareIndex: number }

/** Splits segments into words of chars. Global index i counts every character, spaces included; spaces end a word and emit no char. Only the first non-space char of the first flare segment gets flare: true. */
export function layoutTyping(segments: readonly TypingSegment[]): TypingLayout {
  const text = segments.map((s) => s.text).join('');
  const total = text.length;
  const words: TypingChar[][] = [];
  let cur: TypingChar[] = [];
  let flareIndex = -1;
  let i = 0;
  for (const seg of segments) {
    for (const ch of seg.text) {
      if (ch === ' ') {
        if (cur.length) {
          words.push(cur);
          cur = [];
        }
      } else {
        const flare = !!seg.flare && flareIndex < 0;
        if (flare) flareIndex = i;
        cur.push({ ch, i, gold: !!seg.gold, flare });
      }
      i++;
    }
  }
  if (cur.length) words.push(cur);
  return { text, total, words, flareIndex };
}

/** Number of characters revealed after elapsedMs: 0 before delayMs, then floor((elapsed - delay) / speed) + 1, capped at total. */
export function revealCount(elapsedMs: number, delayMs: number, speedMs: number, total: number): number {
  if (elapsedMs < delayMs) return 0;
  return Math.min(total, Math.floor((elapsedMs - delayMs) / speedMs) + 1);
}
