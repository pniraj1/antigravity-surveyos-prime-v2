'use client';
import { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

// ── Placeholder Car ────────────────────────────────────────────────────────
// Swap with: const { scene } = useGLTF('/models/sedan-damaged.glb'); return <primitive object={scene} />
function DamagedSedan() {
  return (
    <group position={[0, -0.6, 0]} rotation={[0, -0.25, 0]}>
      {/* Main body */}
      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[3.8, 0.85, 1.8]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.92} roughness={0.18} />
      </mesh>
      {/* Cabin */}
      <mesh castShadow position={[0.25, 1.05, 0]}>
        <boxGeometry args={[2.0, 0.75, 1.55]} />
        <meshStandardMaterial color="#0d0d1a" metalness={0.96} roughness={0.08} />
      </mesh>
      {/* Wheels */}
      {([-1.2, 1.2] as number[]).flatMap((x) =>
        ([-0.95, 0.95] as number[]).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.26, 24]} />
            <meshStandardMaterial color="#111" metalness={0.25} roughness={0.85} />
          </mesh>
        ))
      )}
      {/* Crumpled front panel */}
      <mesh castShadow position={[-1.95, 0.45, 0]} rotation={[0, 0, 0.18]}>
        <boxGeometry args={[0.45, 0.65, 1.65]} />
        <meshStandardMaterial color="#2a1515" metalness={0.6} roughness={0.65} />
      </mesh>
      {/* Damage label */}
      <Html position={[-1.9, 1.6, 0]} center distanceFactor={6}>
        <div className="bg-red-500/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap backdrop-blur-sm border border-red-400/30 shadow-lg">
          Front Impact — ₹85,420
        </div>
      </Html>
    </group>
  );
}

// ── Placeholder Robot ──────────────────────────────────────────────────────
// Swap with: const { scene } = useGLTF('/models/robot-humanoid.glb'); return <primitive object={scene} />
function HumanoidRobot({ scrollProgress }: { scrollProgress: React.RefObject<number> }) {
  const glowRef = useRef<THREE.PointLight>(null);
  const headRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, mouse }) => {
    if (glowRef.current) {
      const base = 1 + (scrollProgress.current ?? 0) * 2;
      glowRef.current.intensity = base + Math.sin(clock.elapsedTime * 2.5) * 0.4;
    }
    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, mouse.x * 0.4, 0.05);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -mouse.y * 0.2, 0.05);
    }
  });

  return (
    <group position={[-2.6, -0.6, 0.6]}>
      {/* Torso */}
      <mesh castShadow position={[0, 1.15, 0]}>
        <boxGeometry args={[0.62, 0.82, 0.3]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.96} roughness={0.04} />
      </mesh>
      {/* Head */}
      <mesh ref={headRef} castShadow position={[0, 1.78, 0]}>
        <boxGeometry args={[0.46, 0.46, 0.36]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.98} roughness={0.02} />
      </mesh>
      {/* Eyes */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 1.8, 0.19]}>
          <planeGeometry args={[0.08, 0.04]} />
          <meshStandardMaterial color="#60A5FA" emissive="#60A5FA" emissiveIntensity={3} />
        </mesh>
      ))}
      {/* Chest panel glow */}
      <mesh position={[0, 1.15, 0.16]}>
        <planeGeometry args={[0.22, 0.16]} />
        <meshStandardMaterial color="#60A5FA" emissive="#60A5FA" emissiveIntensity={2.5} transparent opacity={0.9} />
      </mesh>
      <pointLight ref={glowRef} position={[0, 1.15, 0.25]} color="#60A5FA" intensity={1.5} distance={2.5} />
      {/* Arms */}
      {[-0.46, 0.46].map((x) => (
        <mesh key={x} castShadow position={[x, 0.9, 0]}>
          <boxGeometry args={[0.15, 0.72, 0.15]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.96} roughness={0.04} />
        </mesh>
      ))}
      {/* Legs */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} castShadow position={[x, 0.32, 0]}>
          <boxGeometry args={[0.21, 0.72, 0.21]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {/* Holographic notepad */}
      <Html position={[0.9, 1.15, 0]} center distanceFactor={6}>
        <div className="bg-blue-900/60 border border-blue-400/30 rounded-lg p-2 text-[9px] text-blue-300 font-mono whitespace-nowrap backdrop-blur-sm shadow-xl">
          <div className="text-blue-400 font-bold mb-1 tracking-widest uppercase">AI Notes</div>
          <div className="text-green-400">RC: MH12AB1234 ✓</div>
          <div className="text-green-400">DL: Valid ✓</div>
          <div className="text-amber-400">IDV: ₹4,50,000</div>
          <div className="text-green-400">Conflicts: None ✓</div>
        </div>
      </Html>
    </group>
  );
}

// ── Placeholder Surveyor ────────────────────────────────────────────────────
// Swap with: const { scene } = useGLTF('/models/surveyor.glb'); return <primitive object={scene} />
function Surveyor() {
  return (
    <group position={[2.6, -0.6, 0.4]}>
      <mesh castShadow position={[0, 1.05, 0]}>
        <capsuleGeometry args={[0.26, 0.82, 8, 16]} />
        <meshStandardMaterial color="#ea580c" metalness={0.1} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.23, 16, 16]} />
        <meshStandardMaterial color="#fed7aa" roughness={1} />
      </mesh>
      {/* Tablet */}
      <mesh castShadow position={[-0.42, 1.05, 0.12]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.28, 0.4, 0.025]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[-0.42, 1.05, 0.135]} rotation={[0, 0.3, 0]}>
        <planeGeometry args={[0.22, 0.34]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Ground() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.02, 0]}>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#0a0f1a" metalness={0.2} roughness={0.9} />
    </mesh>
  );
}

// ── Camera rig driven by scroll ────────────────────────────────────────────
function CameraRig({ scrollProgressRef }: { scrollProgressRef: React.RefObject<number> }) {
  useFrame(({ camera }) => {
    const p = scrollProgressRef.current ?? 0;
    const tx = -2 + p * 4;
    const ty = 2.2 - p * 0.6;
    const tz = 8 - p * 2.5;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, tx, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, ty, 0.04);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, tz, 0.04);
    camera.lookAt(0, 0.5, 0);
  });
  return null;
}

// ── Public component ────────────────────────────────────────────────────────
interface HeroSceneProps {
  scrollProgressRef: React.RefObject<number>;
}

export function HeroScene({ scrollProgressRef }: HeroSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [-2, 2.2, 8], fov: 45 }}
      style={{ position: 'absolute', inset: 0 }}
      aria-label="3D scene: AI robot and surveyor inspecting a damaged sedan in golden-hour light"
    >
      <CameraRig scrollProgressRef={scrollProgressRef} />
      <ambientLight intensity={0.35} color="#FFF8E7" />
      <directionalLight
        position={[6, 6, 4]}
        intensity={3.5}
        color="#FFB347"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-3, 4, 3]} intensity={0.8} color="#FCD34D" />
      <Environment preset="sunset" />
      <fog attach="fog" args={['#060F1A', 18, 40]} />
      <Suspense fallback={null}>
        <DamagedSedan />
        <HumanoidRobot scrollProgress={scrollProgressRef} />
        <Surveyor />
        <Ground />
      </Suspense>
    </Canvas>
  );
}
