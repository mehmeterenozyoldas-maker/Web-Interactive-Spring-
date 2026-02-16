import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG, PALETTES } from '../constants';
import { InputData } from './HandTracker';
import { AudioData } from './AudioManager';
import { AudioMode } from '../App';

interface Props {
    inputDataRef: React.MutableRefObject<InputData>;
    audioDataRef: React.MutableRefObject<AudioData>;
    audioMode: AudioMode;
}

// --- Simple Spring Physics Class ---
class SpringValue {
    value: number;
    target: number;
    velocity: number;
    stiffness: number;
    damping: number;

    constructor(initial: number, stiffness = 0.1, damping = 0.8) {
        this.value = initial;
        this.target = initial;
        this.velocity = 0;
        this.stiffness = stiffness;
        this.damping = damping;
    }

    update() {
        const force = (this.target - this.value) * this.stiffness;
        this.velocity = this.velocity * this.damping + force;
        this.value += this.velocity;
    }
}

const ColorSlices: React.FC<Props> = ({ inputDataRef, audioDataRef, audioMode }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  
  // Instance colors array to manage smooth transitions
  const currentPaletteRef = useRef<THREE.Color[]>(PALETTES.DEFAULT.map(c => new THREE.Color(c)));
  const targetPaletteRef = useRef<string[]>(PALETTES.DEFAULT);

  // --- Physics State (Springs) ---
  const springs = useMemo(() => ({
      stackHeight: new SpringValue(CONFIG.stackHeight, 0.05, 0.85), // Bouncy spine
      twist: new SpringValue(0, 0.03, 0.90),                        // Flowy twist
      radiusScale: new SpringValue(1.0, 0.1, 0.8),                  // Punchy radius
      chaos: new SpringValue(0, 0.05, 0.9)                          // Slow decay chaos
  }), []);

  // --- Initial Setup ---
  useLayoutEffect(() => {
    if (meshRef.current) {
      for (let i = 0; i < CONFIG.sliceCount; i++) {
        tempObject.position.set(0, 0, 0);
        tempObject.updateMatrix();
        meshRef.current.setMatrixAt(i, tempObject.matrix);
        meshRef.current.setColorAt(i, currentPaletteRef.current[i % 5]);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [tempObject]);

  // --- Animation Loop ---
  useFrame((state) => {
    const time = state.clock.elapsedTime * CONFIG.animationSpeed;
    const { hands, face } = inputDataRef.current;
    const { left, right } = hands;
    const audio = audioDataRef.current;
    
    // --- 1. DETERMINE TARGET PALETTE (Face) ---
    // Default
    let nextPalette = PALETTES.DEFAULT;
    let emotionIntensity = 0;
    
    if (face.present) {
        if (face.smile > 0.4) {
             nextPalette = PALETTES.JOY;
             emotionIntensity = face.smile;
        }
        else if (face.mouthOpen > 0.2) {
             nextPalette = PALETTES.SURPRISE;
             emotionIntensity = face.mouthOpen;
        }
        else if (face.browDown > 0.3) {
             nextPalette = PALETTES.MOODY;
             emotionIntensity = face.browDown;
        }
    }
    targetPaletteRef.current = nextPalette;

    // --- 2. UPDATE SPRINGS (Physics) ---
    
    // Calculate Targets
    let targetHeight = CONFIG.stackHeight;
    let targetTwist = 0;
    let targetRadius = 1.0;
    let targetChaos = 0;

    // Hands Input
    if (left.present) {
        const heightMult = 1.5 + left.y; 
        targetHeight = CONFIG.stackHeight * Math.max(0.5, heightMult);
        targetTwist = left.x * Math.PI * 4;
    }

    if (right.present) {
        targetRadius = 1.0 + (right.y * 0.8);
        targetChaos = (right.x + 1.0) * 0.5;
    }

    // Audio Input (Kick adds immediate velocity to springs for punch)
    if (audioMode !== 'OFF') {
        if (audio.low > 0.4) {
            // Apply force directly to velocity for "Kick" feel
            springs.radiusScale.velocity += audio.low * 0.05; 
            springs.stackHeight.velocity += audio.low * 0.1;
        }
    }

    // Update Springs
    springs.stackHeight.target = targetHeight;
    springs.twist.target = targetTwist;
    springs.radiusScale.target = targetRadius;
    springs.chaos.target = targetChaos;

    Object.values(springs).forEach((s: SpringValue) => s.update());


    // --- 3. APPLY TRANSFORMATIONS ---
    if (meshRef.current) {
        const height = springs.stackHeight.value;
        const twist = springs.twist.value;
        const radiusScale = springs.radiusScale.value;
        const chaos = springs.chaos.value;

        // Color Lerping - INCREASED SPEED for responsiveness
        const lerpSpeed = 0.15; 

        for (let i = 0; i < CONFIG.sliceCount; i++) {
            const t = i / CONFIG.sliceCount;
            const centeredT = t - 0.5;

            // Geometry Physics
            let posX = 0;
            let posY = centeredT * height;
            let posZ = 0;

            // Add organic sine wave that moves up the stack
            const organicWave = Math.sin(t * Math.PI * 6 - time * 2) * 0.2;
            const radius = Math.max(0.1, radiusScale + organicWave);

            // Chaos Jitter
            if (chaos > 0.01) {
                posX += (Math.random() - 0.5) * chaos;
                posZ += (Math.random() - 0.5) * chaos;
            }

            const rotX = Math.PI / 2;
            const rotY = (t * twist) + (time * 0.2);
            
            // "Worm" movement based on noise
            posX += Math.sin(time + t * 4) * (chaos * 2);

            tempObject.rotation.set(rotX, rotY, 0);
            tempObject.position.set(posX, posY, posZ);
            tempObject.scale.set(radius, radius, 1.0);
            
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);

            // Color Blending
            // Get target hex for this index
            const targetHex = targetPaletteRef.current[i % 5];
            const targetColor = new THREE.Color(targetHex);
            
            // Lerp current color towards target
            currentPaletteRef.current[i % 5].lerp(targetColor, lerpSpeed);
            meshRef.current.setColorAt(i, currentPaletteRef.current[i % 5]);
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }

    // --- 4. MATERIAL UPDATES ---
    // Use the radius spring velocity to drive refraction!
    // When the spring oscillates quickly, the glass should "shatter" optically (aberration)
    const springEnergy = Math.abs(springs.radiusScale.velocity) * 10;

    if (materialRef.current) {
        const targetIor = 1.5 + (right.present ? right.pinch : 0) + springEnergy;
        const targetAberration = 0.05 + springEnergy * 0.5;
        
        materialRef.current.ior = THREE.MathUtils.lerp(materialRef.current.ior, targetIor, 0.1);
        materialRef.current.chromaticAberration = THREE.MathUtils.lerp(materialRef.current.chromaticAberration, targetAberration, 0.1);
        
        // Emissive Pulse based on Emotion
        // Neutral = Black emissive. High Emotion = Slight glow of the palette color.
        const baseEmissive = new THREE.Color("#000000");
        const targetEmissive = new THREE.Color(targetPaletteRef.current[0]).multiplyScalar(emotionIntensity * 0.5); // Glow the first color of palette
        materialRef.current.emissive.lerp(targetEmissive, 0.1);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CONFIG.sliceCount]} frustumCulled={false}>
      <torusGeometry args={[CONFIG.radius, CONFIG.tubeThickness, 16, 64]} />
      <meshPhysicalMaterial
        ref={materialRef}
        thickness={2.5}       
        roughness={0.15}      
        transmission={1.0}    
        ior={1.5}             
        chromaticAberration={0.05} 
        attenuationDistance={1.0}  
        attenuationColor="#ffffff"
        color="#ffffff"       
        emissive="#000000"
        clearcoat={1.0}       
        clearcoatRoughness={0.1}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};

export default ColorSlices;