import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AudioMode } from '../App';
import { TwoHandsData } from './HandTracker';

export type AudioData = {
    low: number;  // 0-1 Bass energy
    high: number; // 0-1 Treble energy
    vol: number;  // 0-1 Average volume
};

interface Props {
    audioMode: AudioMode;
    handsDataRef: React.MutableRefObject<TwoHandsData>;
    audioDataRef: React.MutableRefObject<AudioData>;
    listener: THREE.AudioListener;
}

const AudioManager: React.FC<Props> = ({ audioMode, handsDataRef, audioDataRef, listener }) => {
    // Theremin Nodes
    const oscBassRef = useRef<OscillatorNode | null>(null);
    const gainBassRef = useRef<GainNode | null>(null);
    
    const oscLeadRef = useRef<OscillatorNode | null>(null);
    const gainLeadRef = useRef<GainNode | null>(null);
    const vibratoRef = useRef<OscillatorNode | null>(null);
    const vibratoGainRef = useRef<GainNode | null>(null);

    // Analysis Nodes
    const analyserRef = useRef<AnalyserNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    // Data Buffer (Persistent to avoid GC in useFrame)
    const dataArrayRef = useRef<Uint8Array | null>(null);

    // Initialize Analyser once
    useEffect(() => {
        if (!listener) return;
        const ctx = listener.context;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512; // 256 bins
        analyser.smoothingTimeConstant = 0.85; // Smoother
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }, [listener]);

    // Handle Mode Switching and Node Setup
    useEffect(() => {
        if (!listener) return;
        const ctx = listener.context;
        
        // Flag to prevent async setup if effect is cleaned up
        let active = true;

        // --- Cleanup Previous Nodes ---
        const stopNode = (node: OscillatorNode | null) => { try { node?.stop(); node?.disconnect(); } catch(e){} };
        const disconnectNode = (node: AudioNode | null) => { try { node?.disconnect(); } catch(e){} };

        stopNode(oscBassRef.current);
        stopNode(oscLeadRef.current);
        stopNode(vibratoRef.current);
        
        disconnectNode(gainBassRef.current);
        disconnectNode(gainLeadRef.current);
        disconnectNode(vibratoGainRef.current);
        disconnectNode(micSourceRef.current);

        if (micStreamRef.current) { 
            micStreamRef.current.getTracks().forEach(t => t.stop()); 
            micStreamRef.current = null; 
        }

        // --- Setup New Mode ---
        const setupAudio = async () => {
            if (audioMode === 'THEREMIN') {
                // Ensure context is running
                if(ctx.state === 'suspended') {
                    try { await ctx.resume(); } catch(e) { console.warn("Context resume failed", e); }
                }
                
                if (!active) return;
                
                // 1. Bass Drone (Left Hand)
                const oscBass = ctx.createOscillator();
                const gainBass = ctx.createGain();
                oscBass.type = 'sawtooth';
                gainBass.gain.value = 0;
                
                const bassFilter = ctx.createBiquadFilter();
                bassFilter.type = 'lowpass';
                bassFilter.frequency.value = 300; // Deeper

                oscBass.connect(bassFilter);
                bassFilter.connect(gainBass);
                gainBass.connect(analyserRef.current!); 
                gainBass.connect(ctx.destination);      
                oscBass.start();
                
                oscBassRef.current = oscBass;
                gainBassRef.current = gainBass;

                // 2. Lead Synth (Right Hand)
                const oscLead = ctx.createOscillator();
                const gainLead = ctx.createGain();
                oscLead.type = 'triangle';
                gainLead.gain.value = 0; 

                // Vibrato (LFO)
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 6;
                lfoGain.gain.value = 0;
                
                lfo.connect(lfoGain);
                lfoGain.connect(oscLead.frequency); 

                oscLead.connect(gainLead);
                gainLead.connect(analyserRef.current!);
                gainLead.connect(ctx.destination);
                
                oscLead.start();
                lfo.start();

                oscLeadRef.current = oscLead;
                gainLeadRef.current = gainLead;
                vibratoRef.current = lfo;
                vibratoGainRef.current = lfoGain;

            } else if (audioMode === 'MIC') {
                try {
                    if(ctx.state === 'suspended') await ctx.resume();
                    
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        audio: { 
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false // Get raw audio for better music viz
                        }, 
                        video: false 
                    });
                    
                    if (!active) {
                        stream.getTracks().forEach(t => t.stop());
                        return;
                    }

                    micStreamRef.current = stream;
                    const source = ctx.createMediaStreamSource(stream);
                    micSourceRef.current = source;
                    
                    // Add a pre-gain to boost mic signal for visualization if it's too quiet
                    const micGain = ctx.createGain();
                    micGain.gain.value = 3.0; // Boost signal 3x

                    source.connect(micGain);
                    if (analyserRef.current) {
                        micGain.connect(analyserRef.current);
                    }
                } catch (err) {
                    console.error("Mic access denied or error:", err);
                    // We don't change state here to avoid loops, just log
                }
            } else {
                // OFF Mode
                audioDataRef.current = { low: 0, high: 0, vol: 0 };
            }
        };

        setupAudio();

        return () => {
            active = false;
        };
    }, [audioMode, listener]);

    useFrame(() => {
        if (!listener || !listener.context) return;
        const ctx = listener.context;

        // 1. Theremin Control Logic
        if (audioMode === 'THEREMIN') {
            const { left, right } = handsDataRef.current;

            // Bass Control (Left)
            if (oscBassRef.current && gainBassRef.current) {
                if (left.present) {
                    const pitch = 50 + ((left.y + 1) / 2) * 100; 
                    oscBassRef.current.frequency.setTargetAtTime(pitch, ctx.currentTime, 0.05);
                    
                    const vol = Math.max(0, left.pinch) * 0.5; 
                    gainBassRef.current.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
                } else {
                    gainBassRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
                }
            }

            // Lead Control (Right)
            if (oscLeadRef.current && gainLeadRef.current && vibratoGainRef.current) {
                if (right.present) {
                    const pitch = 440 + (right.x * 300);
                    oscLeadRef.current.frequency.setTargetAtTime(pitch, ctx.currentTime, 0.05);
                    
                    // Volume is always on if hand is present, mod by pinch slightly?
                    // Let's make it standard volume, pinch controls Vibrato
                    gainLeadRef.current.gain.setTargetAtTime(0.3, ctx.currentTime, 0.05);

                    const vibDepth = (1 - right.pinch) * 20; 
                    vibratoGainRef.current.gain.setTargetAtTime(vibDepth, ctx.currentTime, 0.05);
                } else {
                    gainLeadRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
                }
            }
        }

        // 2. Audio Analysis (For Visuals)
        if (analyserRef.current && (audioMode === 'MIC' || audioMode === 'THEREMIN') && dataArrayRef.current) {
            const dataArray = dataArrayRef.current;
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // Analyze specific bands
            // FFT Size 512 -> 256 Bins. Sample Rate ~48000. Bin Width ~93Hz.
            
            // Bass: 0-3 (~0-280Hz)
            let bassSum = 0;
            for(let i=0; i<4; i++) bassSum += dataArray[i];
            const avgBass = (bassSum / 4) / 255;
            
            // High Mids / Treble: 20-100 (~1800Hz - 9000Hz)
            let highSum = 0;
            let count = 0;
            for(let i=20; i<100; i++) {
                highSum += dataArray[i];
                count++;
            }
            const avgHigh = (highSum / count) / 255;
            
            // Overall Volume
            let totalSum = 0;
            for(let i=0; i<dataArray.length; i++) totalSum += dataArray[i];
            const avgVol = (totalSum / dataArray.length) / 255;

            // Lerp the ref values for smoothness
            const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
            const smooth = 0.3;
            
            audioDataRef.current.low = lerp(audioDataRef.current.low, avgBass, smooth);
            audioDataRef.current.high = lerp(audioDataRef.current.high, avgHigh, smooth);
            audioDataRef.current.vol = lerp(audioDataRef.current.vol, avgVol, smooth);

        } else {
            // Decay to 0
            const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
            audioDataRef.current.low = lerp(audioDataRef.current.low, 0, 0.1);
            audioDataRef.current.high = lerp(audioDataRef.current.high, 0, 0.1);
            audioDataRef.current.vol = lerp(audioDataRef.current.vol, 0, 0.1);
        }
    });

    return null;
};

export default AudioManager;