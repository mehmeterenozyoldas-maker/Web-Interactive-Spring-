import React, { useRef, useState, useEffect, useMemo } from 'react';
import { OrbitControls, Environment, PerspectiveCamera, Sparkles, SpotLight, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import ColorSlices from './ColorSlices';
import Cursor from './Cursor';
import { InputData } from './HandTracker';
import AudioManager, { AudioData } from './AudioManager';
import { AudioMode } from '../App';

interface Props {
  inputDataRef: React.MutableRefObject<InputData>;
  audioMode: AudioMode;
}

const ReactiveLighting = ({ inputDataRef }: { inputDataRef: React.MutableRefObject<InputData> }) => {
    const spot1Ref = useRef<THREE.SpotLight>(null);
    const spot2Ref = useRef<THREE.SpotLight>(null);
    const ambientRef = useRef<THREE.AmbientLight>(null);

    // Track smoothed values to prevent flickering
    const targetColor1 = useRef(new THREE.Color("#00ffff"));
    const targetColor2 = useRef(new THREE.Color("#ffaa00"));
    const targetIntensity = useRef(80);
    const targetAmbient = useRef(0.5);

    useFrame((state) => {
        const { face } = inputDataRef.current;
        const time = state.clock.elapsedTime;

        // --- Logic to determine target lighting state ---
        if (face.present) {
            if (face.smile > 0.4) {
                // JOY: Warm, Pink/Peach, High Ambient, Soft
                targetColor1.current.set("#FF9AA2"); 
                targetColor2.current.set("#FFDAC1"); 
                targetIntensity.current = 150; 
                targetAmbient.current = 1.2;
            } else if (face.mouthOpen > 0.2) {
                // SURPRISE: Neon Green, High Contrast, Very Bright Spotlight
                targetColor1.current.set("#39FF14");
                targetColor2.current.set("#00FF41");
                targetIntensity.current = 300; 
                targetAmbient.current = 0.1; // Dark shadows
            } else if (face.browDown > 0.3) {
                // MOODY: Deep Blue/Teal, Dim, Mysterious
                targetColor1.current.set("#001219");
                targetColor2.current.set("#0a9396");
                targetIntensity.current = 200; 
                targetAmbient.current = 0.05; // Pitch black shadows
            } else {
                // Neutral Face present
                 targetColor1.current.set("#00ffff");
                 targetColor2.current.set("#ffaa00");
                 targetIntensity.current = 80;
                 targetAmbient.current = 0.5;
            }
        } else {
            // No Face
            targetColor1.current.set("#00ffff");
            targetColor2.current.set("#ffaa00");
            targetIntensity.current = 80;
            targetAmbient.current = 0.5;
        }

        // --- Apply Updates with Lerp ---
        const lerpSpeed = 0.05;

        if (spot1Ref.current) {
            spot1Ref.current.color.lerp(targetColor1.current, lerpSpeed);
            spot1Ref.current.intensity = THREE.MathUtils.lerp(spot1Ref.current.intensity, targetIntensity.current, lerpSpeed);
            
            // Movement 1
            spot1Ref.current.position.x = -8 + Math.sin(time * 0.5) * 4;
            spot1Ref.current.position.y = 10 + Math.cos(time * 0.3) * 2;
        }

        if (spot2Ref.current) {
            spot2Ref.current.color.lerp(targetColor2.current, lerpSpeed);
            spot2Ref.current.intensity = THREE.MathUtils.lerp(spot2Ref.current.intensity, targetIntensity.current, lerpSpeed);

            // Movement 2
            spot2Ref.current.position.x = 8 + Math.sin(time * 0.5 + Math.PI) * 4;
            spot2Ref.current.position.y = -5 + Math.cos(time * 0.3 + Math.PI) * 2;
        }

        if (ambientRef.current) {
            ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, targetAmbient.current, lerpSpeed);
        }
    });

    return (
        <group>
            <ambientLight ref={ambientRef} intensity={0.5} />
            <SpotLight
                ref={spot1Ref}
                position={[-8, 10, 5]}
                angle={0.6}
                penumbra={0.5}
                intensity={80}
                distance={40}
                castShadow
                attenuation={10}
                anglePower={5}
            />
            <SpotLight
                ref={spot2Ref}
                position={[8, -5, 5]}
                angle={0.6}
                penumbra={0.5}
                intensity={80}
                distance={40}
                castShadow
                attenuation={10}
                anglePower={5}
            />
        </group>
    );
};

const Experience: React.FC<Props> = ({ inputDataRef, audioMode }) => {
  // Ref to hold the analyzed audio level for the visuals
  // low: Bass, high: Treble, vol: Average Volume
  const audioDataRef = useRef<AudioData>({ low: 0, high: 0, vol: 0 });

  // Initialize AudioListener once
  const [listener] = useState(() => new THREE.AudioListener());
  const { camera } = useThree();

  useEffect(() => {
    camera.add(listener);
    return () => {
      camera.remove(listener);
    };
  }, [camera, listener]);

  // Adapt input data for existing components that expect just hands for now, or update them
  // We will pass the full inputDataRef to ColorSlices, but Cursor and Audio only need hands for now.
  const handsDataProxy = useRef(inputDataRef.current.hands);
  useFrame(() => {
      handsDataProxy.current = inputDataRef.current.hands;
  });

  return (
    <>
      <AudioManager 
        audioMode={audioMode} 
        handsDataRef={handsDataProxy} 
        audioDataRef={audioDataRef} 
        listener={listener}
      />

      <PerspectiveCamera makeDefault position={[-10, 6, 14]} fov={35} />
      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        maxPolarAngle={Math.PI / 1.5} 
        minPolarAngle={Math.PI / 3}
        autoRotate={true}
        autoRotateSpeed={0.5}
      />

      {/* Deep Forest Slate Background */}
      <color attach="background" args={['#1a1f21']} />
      
      {/* Matching Fog for Depth */}
      <fog attach="fog" args={['#1a1f21', 15, 45]} />

      {/* Main generative object with Physics & Face support */}
      <ColorSlices 
        inputDataRef={inputDataRef}
        audioDataRef={audioDataRef}
        audioMode={audioMode}
      />
      
      {/* Interactive Cursor */}
      <Cursor handsDataRef={handsDataProxy} />

      {/* New Reactive Lighting System */}
      <ReactiveLighting inputDataRef={inputDataRef} />
      
      {/* Fireflies / Pollen - Warmer, slower, more organic */}
      <Sparkles 
        count={300} 
        scale={25} 
        size={3} 
        speed={0.2} 
        opacity={0.6} 
        color="#fffceb" // Warm white
      />

      {/* Reflective Lake Floor */}
      <mesh position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={40}
          roughness={1}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#101516"
          metalness={0.5}
          mirror={0.5} // Typed as 'mirror' in some versions, but acts as reflectivity
        />
      </mesh>

      <EffectComposer disableNormalPass>
        <Bloom 
          luminanceThreshold={0.5} 
          mipmapBlur 
          intensity={0.8} 
          radius={0.7}
        />
        <ChromaticAberration offset={[0.001, 0.001]} />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.1} darkness={0.9} />
      </EffectComposer>
      
      {/* Forest HDRI for softer reflections */}
      <Environment preset="forest" background={false} blur={0.8} />
    </>
  );
};

export default Experience;