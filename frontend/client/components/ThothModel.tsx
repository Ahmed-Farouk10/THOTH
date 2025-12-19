import { useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface ThothModelProps {
  autoRotate?: boolean;
  enableControls?: boolean;
  scale?: number;
  position?: [number, number, number];
}

// Color palette for multi-color materials
const COLOR_PALETTE = {
  obsidian: 0x080808,
  gold: 0xD4AF37,
  sapphire: 0x0F52BA,
  emerald: 0x50C878,
  crimson: 0xDC143C,
  silver: 0xC0C0C0,
  copper: 0xB87333,
  platinum: 0xE5E4E2,
};

function Model({ autoRotate = true }: { autoRotate?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/assets/models/thoth.glb');
  const meshCountRef = useRef(0);

  // Clone the scene to avoid modifying the original
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  // Apply professional multi-color materials with optimizations
  useMemo(() => {
    meshCountRef.current = 0;
    const colors = Object.values(COLOR_PALETTE);
    
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        meshCountRef.current++;
        
        // Cycle through color palette for visual interest
        const colorIndex = meshCountRef.current % colors.length;
        const primaryColor = new THREE.Color(colors[colorIndex]);
        
        // Create PBR material with better performance
        const material = new THREE.MeshPhysicalMaterial({
          color: primaryColor,
          metalness: 0.8,
          roughness: 0.15,
          clearcoat: 0.8,
          clearcoatRoughness: 0.15,
          reflectivity: 1,
          envMapIntensity: 1.8,
          side: THREE.FrontSide,
          wireframe: false,
        });

        // Add subtle gold emissive for premium feel
        material.emissive = new THREE.Color(COLOR_PALETTE.gold);
        material.emissiveIntensity = 0.15;

        mesh.material = material;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Optimize geometry
        if (mesh.geometry) {
          mesh.geometry.computeBoundingBox();
        }
      }
    });
  }, [clonedScene]);

  // Optimized auto-rotate animation
  useFrame(() => {
    if (groupRef.current && autoRotate) {
      groupRef.current.rotation.y += 0.003; // Slower, smoother rotation
    }
  });

  return <primitive ref={groupRef} object={clonedScene} />;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#D4AF37" wireframe />
    </mesh>
  );
}

export default function ThothModel({ 
  autoRotate = true, 
  enableControls = true,
  scale = 1.2,
  position = [0, -0.5, 0]
}: ThothModelProps) {
  return (
    <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1a1510 0%, #0d0a07 100%)' }}>
      <Canvas
        shadows
        dpr={[1, 1.5]} // Limit pixel ratio for better performance
        performance={{ current: 0.8 }}
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
          powerPreference: 'high-performance',
        }}
      >
        {/* Optimized camera - zoomed out for better view */}
        <PerspectiveCamera makeDefault position={[0, 1, 6]} fov={45} />
        
        {/* Professional lighting setup with optimizations */}
        <ambientLight intensity={0.35} />
        
        {/* Main directional light */}
        <directionalLight 
          position={[8, 6, 5]} 
          intensity={0.9}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        
        {/* Accent lights for color dimension */}
        <pointLight position={[-6, 4, -5]} intensity={0.4} color={COLOR_PALETTE.sapphire} />
        <pointLight position={[6, 3, -3]} intensity={0.4} color={COLOR_PALETTE.emerald} />
        <pointLight position={[0, -3, 4]} intensity={0.3} color={COLOR_PALETTE.gold} />
        
        {/* Spotlight for dramatic effect */}
        <spotLight
          position={[0, 8, 0]}
          angle={0.4}
          penumbra={0.8}
          intensity={0.6}
          castShadow
          color={COLOR_PALETTE.platinum}
        />

        {/* HDR Environment for reflections */}
        <Suspense fallback={null}>
          <Environment files="/assets/hdr/studio_small_03_4k.hdr" />
        </Suspense>

        {/* The 3D Model */}
        <group scale={scale} position={position}>
          <Suspense fallback={<LoadingFallback />}> 
            <Model autoRotate={autoRotate} />
          </Suspense>
        </group>

        {/* Interactive controls with better defaults */}
        {enableControls && (
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            minDistance={3}
            maxDistance={15}
            autoRotate={false}
            autoRotateSpeed={0.5}
            dampingFactor={0.05}
            enableDamping={true}
          />
        )}
      </Canvas>
    </div>
  );
}

// Preload the model
useGLTF.preload('/assets/models/thoth.glb');
