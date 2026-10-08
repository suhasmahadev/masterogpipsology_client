import React from 'react';

export function StaticRings(): React.ReactElement {
  const rings = Array.from({ length: 7 }, (_, i) => i);
  return (
    <svg aria-hidden="true" className="absolute inset-0 w-full h-full overflow-visible" viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet">
      {rings.map((i) => (
        <circle key={i} cx={0} cy={0} r={30 + i * 8.8} fill="none"
          stroke={i < 3 ? '#D4AF37' : '#E8D7A8'} strokeWidth={0.35} strokeOpacity={0.6 - i * 0.07} />
      ))}
    </svg>
  );
}
