import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';

export type HandData = {
  present: boolean;
  x: number;
  y: number;
  pinch: number;
};

export type TwoHandsData = {
  left: HandData;
  right: HandData;
};

export type FaceData = {
  present: boolean;
  smile: number;      // 0 to 1
  mouthOpen: number;  // 0 to 1
  browDown: number;   // 0 to 1
};

export type InputData = {
  hands: TwoHandsData;
  face: FaceData;
};

type Props = {
  onUpdate: (data: InputData) => void;
};

const HandTracker: React.FC<Props> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<string>("Initializing AI...");
  const lastVideoTimeRef = useRef<number>(-1);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let faceLandmarker: FaceLandmarker | null = null;
    let animationFrameId: number;
    let active = true;

    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        
        if (!active) return;

        // Initialize BOTH Hand and Face Landmarkers
        // Note: 'delegate: "GPU"' is preferred, but the log about XNNPACK (CPU) is normal 
        // as some operations fall back to CPU or run in parallel.
        const [hLandmarker, fLandmarker] = await Promise.all([
          HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2 
          }),
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
              delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1
          })
        ]);

        handLandmarker = hLandmarker;
        faceLandmarker = fLandmarker;
        
        if (!active) return;

        setStatus("Requesting Camera...");

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                facingMode: "user" 
            } 
          });
          
          if (!active) {
             stream.getTracks().forEach(t => t.stop());
             return;
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Explicitly wait for data and then PLAY
            videoRef.current.onloadeddata = () => {
                if (active && videoRef.current) {
                    videoRef.current.play().then(() => {
                        setStatus("Active (Hands + Face)");
                        predictWebcam();
                    }).catch(e => {
                        console.error("Video play failed:", e);
                        setStatus("Camera Error: Click page to enable");
                    });
                }
            };
          }
        }
      } catch (e: any) {
        console.error("Tracker Error:", e);
        setStatus("Error: " + (e.message || "Unknown"));
      }
    };

    const predictWebcam = () => {
      // Safety checks: Component must be active, models loaded, video exists
      if (!handLandmarker || !faceLandmarker || !videoRef.current) return;
      
      try {
        // Ensure video is actually playing and has dimensions
        if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            
            let startTimeMs = performance.now();
            
            // CRITICAL: MediaPipe crashes if the timestamp is not strictly increasing.
            // If the video frame hasn't advanced, skip detection to save resources and prevent crash.
            if (videoRef.current.currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = videoRef.current.currentTime;
                
                // Run detections
                const handResults = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
                const faceResults = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);
                
                const newData: InputData = {
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
                };

                // --- Hand Logic ---
                if (handResults.landmarks) {
                    for (let i = 0; i < handResults.landmarks.length; i++) {
                        const landmarks = handResults.landmarks[i];
                        const handedness = handResults.handedness[i][0].categoryName;
                        
                        const indexTip = landmarks[8];
                        const thumbTip = landmarks[4];
                        const dx = indexTip.x - thumbTip.x;
                        const dy = indexTip.y - thumbTip.y;
                        const distance = Math.sqrt(dx*dx + dy*dy);
                        const pinch = Math.min(Math.max((distance - 0.02) / 0.15, 0), 1);
                        const x = (1 - indexTip.x) * 2 - 1; 
                        const y = -(indexTip.y * 2 - 1);

                        if (handedness === "Left") newData.hands.left = { present: true, x, y, pinch };
                        else newData.hands.right = { present: true, x, y, pinch };
                    }
                }

                // --- Face Logic (Blendshapes) ---
                if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
                    const shapes = faceResults.faceBlendshapes[0].categories;
                    newData.face.present = true;

                    // Helper to find score
                    const getScore = (name: string) => shapes.find(s => s.categoryName === name)?.score || 0;

                    // Calculate Expressions
                    newData.face.smile = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
                    newData.face.mouthOpen = getScore('jawOpen');
                    newData.face.browDown = (getScore('browDownLeft') + getScore('browDownRight')) / 2;
                }
                
                onUpdate(newData);
            }
        }
      } catch (e) {
          console.warn("Tracking frame error:", e);
      }
      
      // Loop
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setup();

    return () => {
        active = false;
        if(videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (handLandmarker) handLandmarker.close();
        if (faceLandmarker) faceLandmarker.close();
    };
  }, [onUpdate]);

  return (
    <div className="fixed bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden border border-white/20 z-50 transition-opacity bg-black/80">
        <video 
            ref={videoRef} 
            className="w-full h-full object-cover transform -scale-x-100 opacity-50 hover:opacity-100 transition-opacity" 
            autoPlay 
            playsInline 
            muted 
        />
        <div className="absolute top-0 left-0 w-full bg-black/50 text-[10px] text-center text-white p-1 backdrop-blur-sm pointer-events-none">
            {status}
        </div>
    </div>
  );
};

export default HandTracker;