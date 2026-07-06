import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";

function Coin({ speed }: { speed: number }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed;
  });
  return (
    <group ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      {/* Coin body */}
      <mesh castShadow>
        <cylinderGeometry args={[1, 1, 0.16, 72]} />
        <meshStandardMaterial color="#00E5FF" metalness={0.85} roughness={0.25} emissive="#00E5FF" emissiveIntensity={0.22} />
      </mesh>
      {/* Raised inner disc */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.68, 0.68, 0.03, 56]} />
        <meshStandardMaterial color="#EAF6FF" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0, -0.085, 0]}>
        <cylinderGeometry args={[0.68, 0.68, 0.03, 56]} />
        <meshStandardMaterial color="#EAF6FF" metalness={1} roughness={0.15} />
      </mesh>
      {/* Rim */}
      <mesh>
        <torusGeometry args={[1.0, 0.06, 20, 80]} />
        <meshStandardMaterial color="#B7BEE0" metalness={1} roughness={0.1} />
      </mesh>
    </group>
  );
}

/** Client-only WebGL coin for the dashboard hero. Renders nothing during SSR
 *  (guarded by `mounted`) so there's no hydration mismatch; respects
 *  prefers-reduced-motion by slowing the spin to a stop. */
export function Coin3D({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [speed, setSpeed] = useState(0.7);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSpeed(0);
    }
  }, []);

  if (!mounted) return <div className={className} aria-hidden />;

  return (
    <div className={className} aria-hidden>
      <Canvas camera={{ position: [0, 0, 3.1], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.5} />
        <pointLight position={[-3, -2, -2]} intensity={2.2} color="#00E5FF" />
        <pointLight position={[2, 3, 2]} intensity={1.3} color="#5D3FD3" />
        <Suspense fallback={null}>
          <Coin speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  );
}
