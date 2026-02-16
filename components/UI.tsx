import React from 'react';
import * as THREE from 'three';
import { AudioMode } from '../App';

interface Props {
  audioMode: AudioMode;
  setAudioMode: (mode: AudioMode) => void;
}

const UI: React.FC<Props> = ({ audioMode, setAudioMode }) => {
  
  const handleModeChange = (mode: AudioMode) => {
    // CRITICAL: Resume AudioContext immediately on user gesture (click)
    const ctx = THREE.AudioContext.getContext();
    if (ctx.state === 'suspended') {
        ctx.resume().catch(e => console.error("Audio Context Resume Failed", e));
    }
    setAudioMode(mode);
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 flex flex-col justify-between p-8">
      <header>
        <h1 className="text-4xl font-light tracking-tighter text-white opacity-90 drop-shadow-lg">
          Spatial Color Slices
        </h1>
        
        <div className="mt-6 flex flex-wrap gap-4 pointer-events-auto items-center">
            <button 
                onClick={() => handleModeChange('OFF')}
                className={`px-6 py-2 rounded-full text-sm font-bold border transition-all duration-300 ${audioMode === 'OFF' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'bg-black/50 text-gray-400 border-gray-600 hover:text-white hover:border-white'}`}
            >
                SILENT
            </button>
            <button 
                onClick={() => handleModeChange('MIC')}
                className={`px-6 py-2 rounded-full text-sm font-bold border transition-all duration-300 ${audioMode === 'MIC' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'bg-black/50 text-gray-400 border-gray-600 hover:text-white hover:border-white'}`}
            >
                MIC VISUALIZER
            </button>
            <button 
                onClick={() => handleModeChange('THEREMIN')}
                className={`px-6 py-2 rounded-full text-sm font-bold border transition-all duration-300 ${audioMode === 'THEREMIN' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'bg-black/50 text-gray-400 border-gray-600 hover:text-white hover:border-white'}`}
            >
                THEREMIN SYNTH
            </button>
            
            {/* Status Indicator */}
            <div className={`text-xs font-mono px-3 py-1 rounded border transition-colors ${audioMode !== 'OFF' ? 'text-green-400 border-green-900 bg-green-900/20' : 'text-gray-500 border-gray-800 bg-black/20'}`}>
               STATUS: {audioMode === 'OFF' ? 'IDLE' : audioMode === 'MIC' ? 'LISTENING' : 'SYNTH ACTIVE'}
            </div>
        </div>

        <div className="mt-4 flex gap-4">
            <div className="text-sm text-gray-300 font-mono space-y-1 bg-black/40 backdrop-blur-md p-4 rounded-lg inline-block border border-white/10 pointer-events-auto">
            <p className="font-bold text-white mb-2">Controls ({audioMode === 'THEREMIN' ? 'Instrument' : 'Sculpture'})</p>
            
            <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>
                <div>
                <span className="font-bold text-cyan-400 block">Left Hand (Springs)</span>
                <span className="text-xs">
                    Y: Elastic Expand | X: Helix Twist
                </span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-400 shadow-[0_0_8px_#fb923c]"></span>
                <div>
                <span className="font-bold text-orange-400 block">Right Hand (Chaos)</span>
                <span className="text-xs">
                    Y: Radius Size | X: Physics Jitter
                </span>
                </div>
            </div>
            </div>

            <div className="text-sm text-gray-300 font-mono space-y-1 bg-black/40 backdrop-blur-md p-4 rounded-lg inline-block border border-white/10 pointer-events-auto">
                <p className="font-bold text-white mb-2">Color Magic (Face)</p>
                
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-pink-400 font-bold">😊 Smile</span>
                    <span className="text-xs text-gray-400">Pastel Joy</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-400 font-bold">😮 Open Mouth</span>
                    <span className="text-xs text-gray-400">Cyber Neon</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold">😠 Frown</span>
                    <span className="text-xs text-gray-400">Deep Ocean</span>
                </div>
            </div>
        </div>
      </header>
      
      <footer className="flex justify-between items-end">
         <div className="text-xs text-gray-500 font-mono">
           Physics Enabled: Hooke's Law Spring Simulation
         </div>
      </footer>
    </div>
  );
};

export default UI;