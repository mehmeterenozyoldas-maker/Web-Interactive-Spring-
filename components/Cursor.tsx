import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TwoHandsData, HandData } from './HandTracker';

interface Props {
  handsDataRef: React.MutableRefObject<TwoHandsData>;
}

const SingleCursor = ({ 
    hand, 
    colorHex, 
    viewport 
}: { 
    hand: HandData, 
    colorHex: string, 
    viewport: { width: number, height: number } 
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);

    useFrame(() => {
        if (!meshRef.current || !lightRef.current) return;
        const { present, x, y, pinch } = hand;

        if (present) {
            const targetX = (x * viewport.width) / 3; 
            const targetY = (y * viewport.height) / 3;
            const targetZ = 6;

            meshRef.current.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.2);
            
            const scale = 0.2 + pinch * 0.1;
            meshRef.current.scale.setScalar(scale);
            
            // Base color mixed with white based on pinch
            const baseColor = new THREE.Color(colorHex);
            const activeColor = new THREE.Color('#ffffff');
            const color = baseColor.clone().lerp(activeColor, 1 - pinch); // Pinching makes it white/hot
            
            (meshRef.current.material as THREE.MeshBasicMaterial).color = color;
            lightRef.current.color = color;

            meshRef.current.visible = true;
            lightRef.current.intensity = 1 + pinch;
        } else {
            meshRef.current.visible = false;
            lightRef.current.intensity = 0;
        }
    });

    return (
        <group>
            <mesh ref={meshRef}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial transparent opacity={0.8} />
            </mesh>
            <pointLight ref={lightRef} distance={5} decay={2} />
        </group>
    );
}

const Cursor: React.FC<Props> = ({ handsDataRef }) => {
  const { viewport } = useThree();
  // We can't access ref.current in render, so we pass a "getter" or rely on the child reading it in useFrame.
  // However, SingleCursor needs reactive updates. 
  // We can just use the ref inside SingleCursor but we need to know WHICH hand.
  // To keep it clean, we'll wrap a small component that reads the specific hand prop.
  
  // Actually, we can just create two components that read from the main ref inside their own useFrame
  // But passing "hand" data directly isn't reactive if passed as a prop from here unless this component re-renders.
  // This component DOES NOT re-render on hand movement.
  
  // So we pass the WHOLE ref to children, and an identifier.
  
  return (
    <>
      <BoundCursor handsDataRef={handsDataRef} handKey="left" color="#00ffff" viewport={viewport} />
      <BoundCursor handsDataRef={handsDataRef} handKey="right" color="#ffaa00" viewport={viewport} />
    </>
  );
};

const BoundCursor = ({ 
    handsDataRef, 
    handKey, 
    color, 
    viewport 
}: { 
    handsDataRef: React.MutableRefObject<TwoHandsData>, 
    handKey: 'left' | 'right', 
    color: string,
    viewport: any 
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);

    useFrame(() => {
        if (!meshRef.current || !lightRef.current) return;
        const hand = handsDataRef.current[handKey];

        if (hand.present) {
            const targetX = (hand.x * viewport.width) / 3; 
            const targetY = (hand.y * viewport.height) / 3;
            const targetZ = 6;

            meshRef.current.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.2);
            
            const scale = 0.2 + hand.pinch * 0.1;
            meshRef.current.scale.setScalar(scale);
            
            // Interaction visual feedback
            const baseColor = new THREE.Color(color);
            const activeColor = new THREE.Color('#ffffff');
            // Pinch 0 (touching) -> White/Hot. Pinch 1 (open) -> Base Color.
            const finalColor = baseColor.clone().lerp(activeColor, 1 - hand.pinch);
            
            (meshRef.current.material as THREE.MeshBasicMaterial).color = finalColor;
            lightRef.current.color = finalColor;

            meshRef.current.visible = true;
            lightRef.current.intensity = 1.0 + (1 - hand.pinch);
        } else {
            meshRef.current.visible = false;
            lightRef.current.intensity = 0;
        }
    });

    return (
        <group>
            <mesh ref={meshRef}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial transparent opacity={0.8} />
            </mesh>
            <pointLight ref={lightRef} distance={5} decay={2} />
        </group>
    );
};

export default Cursor;