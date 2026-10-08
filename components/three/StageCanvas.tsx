'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';

interface StageCanvasProps {
  alpha?: boolean;
  camera?: { fov: number; position: [number, number, number] };
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

function AdaptiveDpr({ max }: { max: number }): React.ReactElement {
  const setDpr = useThree((s) => s.setDpr);
  return (
    <PerformanceMonitor
      onDecline={() => setDpr(1)}
      onIncline={() => setDpr(max)}
    />
  );
}

/** Shared Canvas: manual frameloop (see ClockBridge), DPR capped at 2, ACES tone mapping. */
export function StageCanvas({
  alpha = false,
  camera = { fov: 30, position: [0, 0, 10] },
  className,
  style,
  children,
}: StageCanvasProps): React.ReactElement {
  const maxDpr = useMemo(() => Math.min(2, window.devicePixelRatio || 1), []);
  return (
    <Canvas
      frameloop="never"
      className={className}
      style={{ pointerEvents: 'none', ...style }}
      dpr={[1, maxDpr]}
      camera={camera}
      gl={{
        antialias: maxDpr < 1.5,
        alpha,
        powerPreference: 'high-performance',
        stencil: false,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.transmissionResolutionScale = 0.5;
      }}
    >
      <AdaptiveDpr max={maxDpr} />
      {children}
    </Canvas>
  );
}
