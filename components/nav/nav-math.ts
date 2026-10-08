export function indicatorTransform(linkLeft: number, linkWidth: number): { x: number; sx: number } {
  return { x: linkLeft, sx: linkWidth };
}

export function stretchKeyframes(
  fromX: number,
  fromW: number,
  toX: number,
  toW: number,
): [{ x: number; sx: number }, { x: number; sx: number }] {
  const left = Math.min(fromX, toX);
  const right = Math.max(fromX + fromW, toX + toW);
  return [
    { x: left, sx: right - left },
    { x: toX, sx: toW },
  ];
}
