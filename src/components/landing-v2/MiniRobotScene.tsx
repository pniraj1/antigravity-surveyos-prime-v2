'use client';
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';

function SpinningRobot() {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.4;
    }
    if (glowRef.current) {
      glowRef.current.intensity = 1.5 + Math.sin(clock.elapsedTime * 3) * 0.5;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.5, 0]} scale={0.8}>
      {/* Torso */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.3]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.96} roughness={0.04} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 1.75, 0]}>
        <boxGeometry args={[0.46, 0.46, 0.36]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.98} roughness={0.02} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0, 1.75, 0.19]}>
        <planeGeometry args={[0.18, 0.08]} />
        <meshStandardMaterial color="#60A5FA" emissive="#60A5FA" emissiveIntensity={3} />
      </mesh>
      {/* Chest panel */}
      <mesh position={[0, 1.1, 0.16]}>
        <planeGeometry args={[0.2, 0.15]} />
        <meshStandardMaterial color="#60A5FA" emissive="#60A5FA" emissiveIntensity={2} transparent opacity={0.85} />
      </mesh>
      <pointLight ref={glowRef} position={[0, 1.1, 0.3]} color="#60A5FA" intensity={1.5} distance={2} />
      {/* Arms */}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} castShadow position={[x, 0.9, 0]}>
          <boxGeometry args={[0.15, 0.68, 0.15]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.96} roughness={0.04} />
        </mesh>
      ))}
      {/* Legs */}
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} castShadow position={[x, 0.3, 0]}>
          <boxGeometry args={[0.2, 0.7, 0.2]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

export function MiniRobotScene() {
  return (
    <div className="w-40 h-48 md:w-56 md:h-64 mx-auto opacity-80">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.2, 3.5], fov: 40 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.4} color="#FFF8E7" />
        <directionalLight position={[3, 4, 3]} intensity={2} color="#FFB347" />
        <Environment preset="sunset" />
        <SpinningRobot />
      </Canvas>
    </div>
  );
}
