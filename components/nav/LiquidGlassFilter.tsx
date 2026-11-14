'use client';
import React, { useEffect, useRef } from 'react';

// Hidden SVG filter used for Chromium-only refraction inside backdrop-filter.
// The displacement map is a 64x64 radial-edge PNG generated once.

function buildMap(): string | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      // Strength grows toward the edges (lens), zero at the centre.
      const sx = Math.sign(nx) * Math.pow(Math.abs(nx), 3);
      const sy = Math.sign(ny) * Math.pow(Math.abs(ny), 3);
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(128 + sx * 127);
      img.data[i + 1] = Math.round(128 + sy * 127);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function LiquidGlassFilter(): React.ReactElement {
  const imgRef = useRef<SVGFEImageElement>(null);
  useEffect(() => {
    const url = buildMap();
    if (url) imgRef.current?.setAttribute('href', url);
  }, []);
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <filter id="lg-refract" x="0" y="0" width="100%" height="100%">
        <feImage ref={imgRef} result="map" preserveAspectRatio="none" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
