'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { mulberry32 } from '@/lib/three/prng';
import { scrollStore } from '@/lib/scroll-store';

interface GoldDustProps {
  count: number;
  area: [number, number, number];
  size?: number;
  color?: string;
  seed?: number;
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uVel;
uniform float uPixelRatio;
uniform float uSize;
uniform vec2 uMouse;
uniform vec3 uArea;
attribute float aSeed;
varying float vTwinkle;

void main() {
  vec3 p = position;
  float y = p.y + uArea.y * 0.5 + uTime * 0.04 * (0.5 + aSeed) + uVel * 0.002;
  p.y = mod(y, uArea.y) - uArea.y * 0.5;
  p.x += sin(uTime * 0.6 + aSeed * 6.283) * 0.04;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec2 d = mv.xy - uMouse;
  float f = smoothstep(1.2, 0.0, length(d));
  mv.xy += normalize(d + vec2(1e-4)) * f * 0.35;
  vTwinkle = 0.6 + 0.4 * sin(uTime * 1.5 + aSeed * 40.0);
  gl_PointSize = uSize * uPixelRatio * (1.0 + abs(uVel) * 0.01) * (20.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vTwinkle;
void main() {
  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * 0.7 * vTwinkle;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;

export function GoldDust({ count, area, size = 1.4, color = '#f2cf6b', seed = 1337 }: GoldDustProps): React.ReactElement {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const vel = useRef(0);
  const camera = useThree((s) => s.camera);

  const geometry = useMemo(() => {
    const rnd = mulberry32(seed);
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * area[0];
      pos[i * 3 + 1] = (rnd() - 0.5) * area[1];
      pos[i * 3 + 2] = (rnd() - 0.5) * area[2];
      seeds[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, area[0], area[1], area[2], seed]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVel: { value: 0 },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uPixelRatio: { value: 1 },
      uSize: { value: size },
      uColor: { value: new THREE.Color(color) },
      uArea: { value: new THREE.Vector3(area[0], area[1], area[2]) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, color, area[0], area[1], area[2]],
  );

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    const target = Math.max(-60, Math.min(60, scrollStore.velocity));
    vel.current += (target - vel.current) * 0.08;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uVel.value = vel.current;
    // Mouse in view space at the scene origin depth.
    const cam = camera as THREE.PerspectiveCamera;
    const dist = Math.hypot(cam.position.x, cam.position.y, cam.position.z);
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * dist;
    (m.uniforms.uMouse.value as THREE.Vector2).set(scrollStore.mouseX * halfH * cam.aspect, scrollStore.mouseY * halfH);
    m.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
