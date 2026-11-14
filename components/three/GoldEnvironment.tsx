'use client';

import { Environment, Lightformer } from '@react-three/drei';

/** Procedural studio environment baked once (no HDR download, decision D7). */
export function GoldEnvironment(): React.ReactElement {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" color="#fff1d6" intensity={3} position={[-4, 3, 4]} scale={[6, 4, 1]} />
      <Lightformer
        form="rect"
        color="#d4af37"
        intensity={2}
        position={[4, 1, 2]}
        rotation={[0, -Math.PI / 3, Math.PI / 8]}
        scale={[1.5, 6, 1]}
      />
      <Lightformer form="ring" color="#ffffff" intensity={1} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={5} />
      <Lightformer form="rect" color="#0a0806" intensity={0.4} position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[14, 14, 1]} />
    </Environment>
  );
}
