'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Maximize2, Minimize2 } from 'lucide-react';

interface WebcamPreviewProps {
    className?: string;
    onFrame?: (base64: string) => void;
    onStream?: (stream: MediaStream) => void;
    frameInterval?: number; // ms
    stream?: MediaStream; // External stream to use instead of starting a new one
}

export const WebcamPreview: React.FC<WebcamPreviewProps> = ({
    className,
    onFrame,
    onStream,
    frameInterval = 1000,
    stream: externalStream
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize canvas for frame extraction
    useEffect(() => {
        canvasRef.current = document.createElement('canvas');
    }, []);

    useEffect(() => {
        let intervalId: any;

        if (stream && onFrame) {
            intervalId = setInterval(() => {
                if (videoRef.current && canvasRef.current) {
                    const video = videoRef.current;
                    const canvas = canvasRef.current;

                    // Set canvas size to match video aspect ratio but smaller for bandwidth
                    const width = 320;
                    const height = (video.videoHeight / video.videoWidth) * width;
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, width, height);
                        const base64 = canvas.toDataURL('image/jpeg', 0.6); // 60% quality
                        onFrame(base64);
                    }
                }
            }, frameInterval);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [stream, onFrame, frameInterval]);

    useEffect(() => {
        if (externalStream) {
            console.log('[WebcamPreview] Using external stream');
            if (videoRef.current) {
                videoRef.current.srcObject = externalStream;
            }
            setStream(externalStream);
            if (onStream) onStream(externalStream);
            return;
        }

        async function startCamera() {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    },
                    audio: false // Audio is handled separately by AudioManager
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
                setStream(mediaStream);
                if (onStream) onStream(mediaStream);
            } catch (err) {
                console.error('Error accessing webcam:', err);
                setError('Camera access denied');
            }
        }

        startCamera();

        return () => {
            // Only stop tracks if we created the stream ourselves
            if (stream && !externalStream) {
                console.log('[WebcamPreview] Stopping internal stream');
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [externalStream, stream]);

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center bg-gray-900/50 rounded-2xl border border-red-500/30 p-4 ${className}`}>
                <CameraOff className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-xs text-red-400 font-medium">{error}</p>
            </div>
        );
    }

    return (
        <div
            className={`relative group bg-[#0a0e1a] rounded-2xl border border-[#2a3050] overflow-hidden shadow-2xl transition-all duration-500 ${className}`}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: 'scaleX(-1)' }} // Mirror effect
            />

            {/* Overlay Controls */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Preview</span>
                    </div>
                </div>
            </div>

            {!stream && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e1a]">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Connecting Cam...</p>
                    </div>
                </div>
            )}
        </div>
    );
};
