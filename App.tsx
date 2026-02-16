import React, { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import Experience from './components/Experience';
import UI from './components/UI';
import InputTracker, { InputData } from './components/HandTracker'; // Renamed import conceptually

export type AudioMode = 'OFF' | 'MIC' | 'THEREMIN';

const App: React.FC = () => {
  // Shared ref for hand and face tracking data
  const inputDataRef = useRef<InputData>({ 
    hands: {
        left: { present: false, x: 0, y: 0, pinch: 0 },
        right: { present: false, x: 0, y: 0, pinch: 0 }
    },
    face: {
        present: false,
        smile: 0,
        mouthOpen: 0,
        browDown: 0
    }
  });

  const [audioMode, setAudioMode] = useState<AudioMode>('OFF');

  return (
    <div className="relative w-full h-screen bg-[#1a1f21]">
      <UI audioMode={audioMode} setAudioMode={setAudioMode} />
      
      {/* Tracker runs outside canvas, updates ref */}
      <InputTracker onUpdate={(data) => { inputDataRef.current = data; }} />
      
      <Canvas
        dpr={[1, 2]} 
        gl={{ 
          antialias: false,
          stencil: false,
          depth: true,
          powerPreference: "high-performance"
        }}
        camera={{ position: [-10, 6, 14], fov: 35 }}
      >
        <Suspense fallback={null}>
          <Experience 
            inputDataRef={inputDataRef}
            audioMode={audioMode} 
          />
        </Suspense>
      </Canvas>
      <Loader 
        containerStyles={{ background: '#1a1f21' }}
        innerStyles={{ width: '400px', height: '4px', background: '#333' }}
        barStyles={{ background: '#D7CEA3', height: '4px' }}
        dataInterpolation={(p) => `Loading AI Models ${p.toFixed(0)}%`}
      />
    </div>
  );
};

export default App;