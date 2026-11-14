import React, { Fragment } from 'react';
import { rollDecoys, splitChars, splitWords, type UnitKind } from '@/lib/text-motion';

/**
 * Words in overflow masks; each word (letters = false) or each letter (letters = true) is one scrubbed unit ([data-u]).
 * Spaces stay as text nodes between words, so lines wrap naturally. Callers hide this from AT and provide an sr-only copy.
 * mask = false (the 'track' kind): no overflow clip, letters fly freely. kind 'roll' (letters): each letter carries static decoy glyphs.
 */
export function SplitWords({ text, kind = 'tilt', letters = false, mask = true }: { text: string; kind?: UnitKind; letters?: boolean; mask?: boolean }): React.ReactElement {
  const words = splitWords(text);
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className={mask ? 'tm-mask' : 'tm-word'}>
            {letters
              ? splitChars(w).map((c, k) => kind === 'roll'
                ? (
                  <span key={k} className="tm-mask tm-mask--roll">
                    <span className="tm-u tm-roll" data-u="roll">
                      {c}
                      {rollDecoys(c).map((d, i) => <span key={i} className="tm-roll__d" style={{ top: `${(i + 1) * 100}%` }}>{d}</span>)}
                    </span>
                  </span>
                )
                : <span key={k} className="tm-u" data-u={kind}>{c}</span>)
              : <span className="tm-u" data-u={kind}>{w}</span>}
          </span>
        </Fragment>
      ))}
    </>
  );
}
export default SplitWords;
