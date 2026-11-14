/** Weeks (1-based, inclusive) covered by a chapter: chapter i covers [2i+1, 2i+2] for 6 chapters over 12 weeks. */
export function weeksForChapter(index: number, chapters = 6, weeks = 12): [number, number] {
  const per = weeks / chapters;
  return [Math.round(index * per) + 1, Math.round((index + 1) * per)];
}
