'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface AIAvatarProps {
    isSpeaking: boolean;
    isListening: boolean;
    audioLevel?: number;
    className?: string;
}

export const AIAvatar: React.FC<AIAvatarProps> = ({ isSpeaking, isListening, audioLevel = 0, className }) => {
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            {/* Background Glows */}
            <div
                className={`absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full transition-all duration-700 ${isSpeaking ? 'opacity-100 scale-125' : 'opacity-40 scale-100'
                    }`}
            />
            <div
                className={`absolute inset-0 bg-purple-500/10 blur-[100px] rounded-full transition-all duration-1000 delay-100 ${isListening ? 'opacity-100 scale-110' : 'opacity-20 scale-90'
                    }`}
            />

            {/* Main Avatar Container */}
            <div className={`relative z-10 w-48 h-48 md:w-64 md:h-64 flex items-center justify-center transition-transform duration-500 ${isSpeaking ? 'scale-105' : 'scale-100'
                }`}>

                {/* 3D Ring Effect */}
                <div className={`absolute inset-0 rounded-full border-2 border-indigo-500/30 transition-all duration-500 ${isSpeaking ? 'animate-[spin_4s_linear_infinite]' : 'animate-[spin_10s_linear_infinite]'
                    }`} />
                <div className={`absolute inset-4 rounded-full border border-purple-500/20 transition-all duration-700 ${isSpeaking ? 'animate-[spin_3s_linear_infinite_reverse]' : 'animate-[spin_8s_linear_infinite_reverse]'
                    }`} />

                {/* Core Avatar Sphere */}
                <div className="relative w-40 h-40 md:w-56 md:h-56 rounded-full bg-[#0a0e1a] border-2 border-indigo-500/50 flex items-center justify-center overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.4)]">

                    {/* Visualizer bars */}
                    <div className="flex items-center justify-center gap-1.5 h-16">
                        {[...Array(7)].map((_, i) => (
                            <div
                                key={i}
                                className="w-2 md:w-3 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-full transition-all duration-150 ease-out"
                                style={{
                                    height: isSpeaking
                                        ? `${30 + Math.random() * 70}%`
                                        : `${10 + (Math.sin(Date.now() / 500 + i) * 10)}%`,
                                    opacity: isSpeaking ? 1 : 0.4
                                }}
                            />
                        ))}
                    </div>

                    {/* Aura pulses */}
                    <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 transition-opacity duration-500 ${isSpeaking ? 'opacity-100' : 'opacity-30'
                        }`} />
                </div>

                {/* Status Indicator */}
                <div className="absolute -bottom-4 bg-[#1a1f36] border border-[#2a3050] px-4 py-1.5 rounded-full flex items-center gap-2 shadow-xl">
                    <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-indigo-400'}`} />
                    <span className="text-[10px] font-black uppercase text-white tracking-[0.1em]">
                        {isSpeaking ? 'AI Responding' : 'Alex Listening'}
                    </span>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div >
    );
};
