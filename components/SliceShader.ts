import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

const SliceMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor1: new THREE.Color('#D7CEA3'),
    uColor2: new THREE.Color('#907826'),
    uColor3: new THREE.Color('#A46719'),
    uColor4: new THREE.Color('#CE3F0E'),
    uColor5: new THREE.Color('#1A0C47'),
    uNoiseScale: 2.0,
    uNoiseStrength: 0.5,
    uHueShift: 0.0,
    uOffset: 0.0,
    uCrystalMode: 0.0, // 0 = Solid, 1 = Crystal
  },
  // Vertex Shader
  `
    uniform float uTime;
    uniform float uNoiseScale;
    uniform float uNoiseStrength;

    varying vec2 vUv;
    varying float vNoise;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    // --- Simplex Noise 2D ---
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vUv = uv;

      // Access the instance transformation matrix automatically provided by Three.js for InstancedMesh
      vec3 instancePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float instanceHeight = instancePos.y;

      vec4 worldPos = instanceMatrix * vec4(position, 1.0);
      float angle = atan(worldPos.x, worldPos.z);
      
      float n1 = snoise(vec2(angle * uNoiseScale, instanceHeight * 0.4 - uTime * 0.2));
      float n2 = snoise(vec2(angle * uNoiseScale * 2.5, instanceHeight * 0.4 + uTime * 0.1)) * 0.5;
      float totalNoise = n1 + n2;

      vNoise = totalNoise;
      vHeight = instanceHeight;

      // Displacement
      vec2 centerDir = normalize(position.xy);
      vec3 newPos = position;
      float displacementAmount = totalNoise * uNoiseStrength;
      
      newPos.x += centerDir.x * displacementAmount;
      newPos.y += centerDir.y * displacementAmount;

      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(newPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Pass data for fragment
      vViewPosition = -mvPosition.xyz;
      // Recalculate normal approximation (simplified)
      vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    }
  `,
  // Fragment Shader
  `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform vec3 uColor5;
    uniform float uHueShift;
    uniform float uOffset;
    uniform float uCrystalMode;

    varying float vNoise;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    // Linear interpolation palette
    vec3 getPalette(float t) {
      vec3 c1 = uColor1;
      vec3 c2 = uColor2;
      vec3 c3 = uColor3;
      vec3 c4 = uColor4;
      vec3 c5 = uColor5;

      float segment = t * 4.0;
      if (segment < 1.0) return mix(c5, c4, segment);
      if (segment < 2.0) return mix(c4, c3, segment - 1.0);
      if (segment < 3.0) return mix(c3, c2, segment - 2.0);
      return mix(c2, c1, segment - 3.0);
    }

    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
      float normalizedHeight = (vHeight + 6.0) / 12.0;
      normalizedHeight = clamp(normalizedHeight, 0.0, 1.0);

      float paletteT = normalizedHeight + vNoise * 0.1 + uOffset;
      paletteT = fract(paletteT);

      vec3 color = getPalette(paletteT);

      if (uHueShift > 0.01 || uHueShift < -0.01) {
          vec3 hsv = rgb2hsv(color);
          hsv.x = fract(hsv.x + uHueShift);
          color = hsv2rgb(hsv);
      }

      float highlight = smoothstep(0.4, 1.0, vNoise);
      color += vec3(1.0, 1.0, 1.0) * highlight * 0.6;
      color *= 1.2;

      // Crystal Mode Logic
      float alpha = 1.0;
      if (uCrystalMode > 0.5) {
          // Desaturate slightly for icy look
          vec3 hsv = rgb2hsv(color);
          hsv.y *= 0.6; 
          hsv.z += 0.4;
          color = hsv2rgb(hsv);

          // Fresnel Effect for Transparency
          vec3 viewDir = normalize(vViewPosition);
          vec3 normal = normalize(vNormal);
          float fresnel = dot(viewDir, normal);
          fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
          
          // Edges are bright and opaque, center is transparent
          alpha = pow(fresnel, 3.0) * 0.8 + 0.1;
          color += vec3(0.5, 0.8, 1.0) * pow(fresnel, 2.0) * 2.0; // Blue-ish rim light
      }

      gl_FragColor = vec4(color, alpha);

      gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));
    }
  `
);

export { SliceMaterial };