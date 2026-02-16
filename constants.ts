import * as THREE from 'three';

// --- Palettes triggered by Facial Expressions ---

export const PALETTES = {
  DEFAULT: [ // Golden/Elegant (Neutral)
    '#D7CEA3', '#907826', '#A46719', '#CE3F0E', '#1A0C47'
  ],
  JOY: [ // Candy/Pastel (Smile)
    '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7'
  ],
  SURPRISE: [ // Neon/Cyber (Mouth Open)
    '#00FF41', '#008F11', '#003B00', '#D0F0C0', '#39FF14'
  ],
  MOODY: [ // Deep Ocean/Abyssal (Frown)
    '#001219', '#005f73', '#0a9396', '#94d2bd', '#e9d8a6'
  ]
};

export const PALETTE_COLORS = PALETTES.DEFAULT; // Fallback

export const CONFIG = {
  sliceCount: 60, 
  radius: 1.5,
  stackHeight: 12,
  tubeThickness: 0.05, 
  animationSpeed: 0.4,
  noiseScale: 2.5,
  bloomThreshold: 0.2,
  bloomIntensity: 1.5,
};