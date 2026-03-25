'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
    Mic,
    MicOff,
    History,
    MessageSquare,
    CheckCircle,
    AlertCircle,
    Info,
    ChevronRight,
    Loader2,
    Volume2,
    ShieldCheck,
    Clock,
    Camera,
    CameraOff
} from 'lucide-react';
import { useAudioManager } from '@/hooks/useAudioManager';
import { useLiveSession } from '@/hooks/useLiveSession';
import { getPublicInterviewInfo } from '@/lib/api';
import { WebcamPreview } from '@/components/interview/WebcamPreview';
import { AIAvatar } from '@/components/interview/AIAvatar';

enum InterviewPhase {
    LOADING = 'LOADING',
    WELCOME = 'WELCOME',
    INTERVIEWING = 'INTERVIEWING',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR'
}

export default function InterviewPage() {
    const { token } = useParams<{ token: string }>();
    const [phase, setPhase] = useState<InterviewPhase>(InterviewPhase.LOADING);
    const [interviewInfo, setInterviewInfo] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState<number>(1800);
    const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);

    // Recording Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

    // Initial camera setup for stability
    useEffect(() => {
        async function initCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    },
                    audio: false
                });
                setCameraStream(stream);
            } catch (err) {
                console.error('Failed to initialize camera:', err);
            }
        }
        initCamera();

        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(t => t.stop());
            }
        };
    }, []);
    // 30 minutes initial

    const audioManager = useAudioManager({
        onAudioData: (data) => session.sendAudio(data)
    });

    const session = useLiveSession({
        token,
        onAudioResponse: (data: string, mimeType: string) => audioManager.playAudio(data, mimeType),
        onStatusChange: (status: string) => {
            if (status === 'completed') handleEndInterview();
        },
        onError: (err: string) => {
            console.error('Session error:', err);
        }
    });

    useEffect(() => {
        async function fetchData() {
            try {
                const info = await getPublicInterviewInfo(token);
                setInterviewInfo(info);
                if (info.status === 'COMPLETED') {
                    setPhase(InterviewPhase.COMPLETED);
                } else if (info.status === 'EXPIRED') {
                    setPhase(InterviewPhase.ERROR);
                    setErrorMessage('This interview link has expired.');
                } else {
                    setPhase(InterviewPhase.WELCOME);
                }
            } catch (err: any) {
                console.error('Error fetching interview info:', err);
                setPhase(InterviewPhase.ERROR);
                setErrorMessage(err.message || 'Failed to load interview information. Please ensure the link is correct.');
            }
        }
        if (token) fetchData();
    }, [token]);

    // Timer logic
    useEffect(() => {
        if (phase !== InterviewPhase.INTERVIEWING) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 0) {
                    clearInterval(timer);
                    handleEndInterview();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [phase]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const uploadRecording = async (blob: Blob) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', blob, 'interview_recording.webm');

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await fetch(`${apiUrl}/api/interview/${token}/upload-recording`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to upload interview recording');
            }

            console.log('Recording uploaded to SharePoint successfully');
        } catch (err) {
            console.error('Error uploading recording:', err);
        } finally {
            setIsUploading(false);
            setPhase(InterviewPhase.COMPLETED);
        }
    };

    const handleStartInterview = async () => {
        const success = await audioManager.startRecording();
        if (success) {
            setPhase(InterviewPhase.INTERVIEWING);
            session.connect();

            try {
                // Use the centralized camera stream
                if (!cameraStream) {
                    throw new Error('Webcam not initialized. Please ensure camera permissions are granted.');
                }

                // Get mixed audio from audioManager (contains both Candidate and AI voices)
                const mixedAudioStream = audioManager.getMixedStream();

                // Combine Webcam Video with Mixed Audio
                const combinedStream = new MediaStream([
                    ...cameraStream.getVideoTracks(),
                    ...(mixedAudioStream ? mixedAudioStream.getAudioTracks() : [])
                ]);

                // We use a separate ref for the active recording stream
                streamRef.current = combinedStream;

                chunksRef.current = [];

                const mimeTypes = [
                    'video/webm;codecs=vp8,opus',
                    'video/webm',
                    'video/mp4'
                ];
                const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

                const recorder = new MediaRecorder(combinedStream, {
                    mimeType: mimeType || undefined
                });

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunksRef.current.push(e.data);
                    }
                };

                recorder.onstop = () => {
                    const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
                    uploadRecording(blob);
                };

                recorder.start(1000);
                mediaRecorderRef.current = recorder;
                console.log(`[MediaRecorder] Started with Webcam and Mixed Audio. MimeType: ${mimeType}`);

            } catch (err: any) {
                console.error('Failed to start recording:', err);
                setErrorMessage('Warning: Recording failed to start. The interview will continue, but it will not be recorded. Error: ' + err.message);
            }
        }
    };

    const handleEndInterview = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log('Stopping recording...');
            mediaRecorderRef.current.stop();
            // The onstop handler will trigger uploadRecording
        } else {
            setPhase(InterviewPhase.COMPLETED);
        }

        session.disconnect();
        audioManager.stopRecording();
    };

    const toggleCamera = () => {
        setIsCameraOff(!isCameraOff);
    };

    // Auto-scroll transcript
    useEffect(() => {
        const container = document.getElementById('transcript-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, [session.transcript]);

    if (phase === InterviewPhase.LOADING || isUploading) {
        return (
            <div className="min-h-screen bg-[#02040a] flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                    {isUploading ? 'Finalizing Interview...' : 'Preparing Environment...'}
                </h2>
                <p className="text-slate-400 text-center max-w-md">
                    {isUploading
                        ? 'Please wait while we securely save your interview recording and transcript.'
                        : 'Setting up your secure interview space with Alex.'}
                </p>
            </div>
        );
    }

    if (phase === InterviewPhase.ERROR) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border)] p-10 text-center shadow-2xl">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                        <AlertCircle className="w-10 h-10 text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Access Issue</h1>
                    <p className="text-[var(--text-secondary)] mb-10 leading-relaxed">{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-2xl font-bold hover:brightness-110 transition-all border border-[var(--border)]"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (phase === InterviewPhase.WELCOME) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <div style={{ maxWidth: '1024px', width: '100%' }}>
                    <div style={{ backgroundColor: '#1a1f36', borderRadius: '48px', border: '1px solid #2a3050', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', padding: '48px', display: 'flex', flexDirection: 'column', gap: '48px' }}>
                        {/* Header */}
                        <div style={{ paddingBottom: '48px', borderBottom: '1px solid #2a3050', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.2)', borderRadius: '9999px', width: 'fit-content' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#818cf8', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Live Interview</span>
                            </div>

                            <div>
                                <h1 style={{ fontSize: '48px', fontWeight: 900, color: 'white', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: '12px' }}>
                                    Welcome{interviewInfo?.candidate_name ? `, ${interviewInfo.candidate_name.split(' ')[0]}` : ''}
                                </h1>
                                <p style={{ color: '#94a3b8', fontSize: '18px', lineHeight: 1.6 }}>
                                    You're interviewing for the <span style={{ color: '#818cf8', fontWeight: 700 }}>{interviewInfo?.job_title}</span> position at <span style={{ color: 'white', fontWeight: 700 }}>{interviewInfo?.company_name}</span>
                                </p>
                            </div>
                        </div>

                        {/* Content Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'stretch' }}>
                            {/* Left: Info & Details */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em' }}>What to expect</h3>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <li style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(79, 70, 229, 0.3)', marginTop: '2px' }}>
                                                <Volume2 style={{ width: '16px', height: '16px', color: '#818cf8' }} />
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>Live Voice Conversation</p>
                                                <p style={{ color: '#64748b', fontSize: '12px' }}>Real-time dialogue with advanced AI</p>
                                            </div>
                                        </li>
                                        <li style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(79, 70, 229, 0.3)', marginTop: '2px' }}>
                                                <Clock style={{ width: '16px', height: '16px', color: '#818cf8' }} />
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>30 Minutes Maximum</p>
                                                <p style={{ color: '#64748b', fontSize: '12px' }}>Timer will track your session</p>
                                            </div>
                                        </li>
                                        <li style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(79, 70, 229, 0.3)', marginTop: '2px' }}>
                                                <Mic style={{ width: '16px', height: '16px', color: '#818cf8' }} />
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>Microphone Required</p>
                                                <p style={{ color: '#64748b', fontSize: '12px' }}>Find a quiet space to speak clearly</p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <button
                                    onClick={handleStartInterview}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        padding: '16px 32px',
                                        backgroundColor: '#4f46e5',
                                        color: 'white',
                                        borderRadius: '24px',
                                        fontWeight: 900,
                                        fontSize: '18px',
                                        letterSpacing: '0.05em',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 0 30px rgba(79, 70, 229, 0.4)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#4338ca';
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 0 40px rgba(79, 70, 229, 0.6)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#4f46e5';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 0 30px rgba(79, 70, 229, 0.4)';
                                    }}
                                >
                                    <Mic style={{ width: '20px', height: '20px' }} />
                                    <span>Start Interview</span>
                                    <ChevronRight style={{ width: '20px', height: '20px' }} />
                                </button>

                                <p style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6, textAlign: 'center' }}>
                                    By starting, you agree to have your audio processed for recruitment evaluation.
                                </p>
                            </div>

                            {/* Right: Interviewer Info */}
                            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: '40px', border: '1px solid #2a3050', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px', height: '100%', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(79, 70, 229, 0.1), transparent)', pointerEvents: 'none' }} />

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', width: '100%' }}>
                                    <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Camera & Mic Check</h3>

                                    <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#0a0e1a', borderRadius: '24px', border: '1px solid #2a3050', overflow: 'hidden', position: 'relative' }}>
                                        {!isCameraOff ? (
                                            <WebcamPreview
                                                className="w-full h-full object-cover"
                                                stream={cameraStream || undefined}
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b' }}>
                                                <CameraOff className="w-12 h-12 opacity-20" />
                                                <span style={{ fontSize: '14px', fontWeight: 600 }}>Camera Disabled</span>
                                            </div>
                                        )}
                                        <button
                                            onClick={toggleCamera}
                                            style={{
                                                position: 'absolute',
                                                top: '16px',
                                                right: '16px',
                                                width: '44px',
                                                height: '44px',
                                                backgroundColor: isCameraOff ? '#f59e0b' : 'rgba(15, 23, 42, 0.7)',
                                                color: 'white',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                backdropFilter: 'blur(12px)',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'scale(1.1)';
                                                e.currentTarget.style.backgroundColor = isCameraOff ? '#fbbf24' : 'rgba(15, 23, 42, 0.9)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.backgroundColor = isCameraOff ? '#f59e0b' : 'rgba(15, 23, 42, 0.7)';
                                            }}
                                            title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
                                        >
                                            {isCameraOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'white', margin: 0 }}>Ready to start?</h2>
                                        <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 500, margin: '4px 0 0 0' }}>Alex is waiting for you</p>
                                    </div>
                                </div>

                                <div style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', borderRadius: '16px', border: '1px solid rgba(79, 70, 229, 0.2)', padding: '20px', width: '100%', position: 'relative', zIndex: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                        <span style={{ fontSize: '11px', fontWeight: 900, color: 'white', textTransform: 'uppercase' }}>Encrypted Session</span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                                        Your video and audio are transmitted over a secure connection. Only authorized reviewers will see the final assessment.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <style>{`
                    @keyframes bounce {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-12px); }
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                `}</style>
            </div>
        );
    }

    if (phase === InterviewPhase.INTERVIEWING) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#0a0e1a', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <header style={{ padding: '0 32px', height: '80px', borderBottom: '1px solid #2a3050', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, backgroundColor: 'rgba(26, 31, 54, 0.8)', backdropFilter: 'blur(12px)', zIndex: 30 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#818cf8', animation: 'pulse 2s infinite' }} />
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>Live Interview</p>
                            <h2 style={{ color: 'white', fontWeight: 900, margin: '4px 0 0 0', fontSize: '16px' }}>{interviewInfo?.company_name}</h2>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Time Remaining</span>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: timeLeft < 300 ? '#f87171' : '#818cf8', fontVariantNumeric: 'tabular-nums' }}>
                                {formatTime(timeLeft)}
                            </div>
                        </div>
                        <div style={{ width: '1px', height: '40px', backgroundColor: '#2a3050' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)', animation: 'pulse 1.5s infinite' }} />
                            <span style={{ fontSize: '10px', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.15em' }}>REC</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: '10px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Connected</span>
                        </div>
                    </div>
                </header>

                <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'row', gap: '24px', padding: '24px', maxWidth: '1600px', width: '100%', margin: '0 auto', overflow: 'hidden' }}>
                    {/* Main Avatar Area */}
                    <div style={{ flex: 1, backgroundColor: '#1a1f36', borderRadius: '40px', border: '1px solid #2a3050', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                        {/* Background gradient */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(79, 70, 229, 0.05), transparent)', opacity: 0.4 }} />

                        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', width: '100%' }}>
                            <AIAvatar
                                isSpeaking={session.isAiSpeaking}
                                isListening={!session.isAiSpeaking}
                                audioLevel={audioManager.audioLevel}
                            />

                            {/* Name & Role */}
                            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <h3 style={{ fontSize: '36px', fontWeight: 900, color: 'white', margin: 0 }}>Alex</h3>
                                <p style={{ color: '#818cf8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '12px', margin: 0 }}>AI Talent Scout</p>
                            </div>
                        </div>

                        {/* Controls at bottom */}
                        <div style={{ position: 'absolute', bottom: '32px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <button
                                onClick={audioManager.toggleMute}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 200ms',
                                    fontWeight: 900,
                                    fontSize: '18px',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    backgroundColor: audioManager.isMuted ? '#ef4444' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    boxShadow: audioManager.isMuted ? '0 0 20px rgba(239, 68, 68, 0.3)' : '0 8px 24px rgba(0, 0, 0, 0.2)'
                                }}
                                title={audioManager.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                            >
                                {audioManager.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>

                            <button
                                onClick={toggleCamera}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 200ms',
                                    fontWeight: 900,
                                    fontSize: '18px',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    backgroundColor: isCameraOff ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    boxShadow: isCameraOff ? '0 0 20px rgba(245, 158, 11, 0.3)' : '0 8px 24px rgba(0, 0, 0, 0.2)'
                                }}
                                title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
                            >
                                {isCameraOff ? <CameraOff className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                            </button>

                            <button
                                onClick={handleEndInterview}
                                style={{
                                    padding: '16px 32px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    transition: 'all 200ms'
                                }}
                            >
                                End Session
                            </button>
                        </div>
                    </div>

                    {/* Interview Analysis Sidebar */}
                    <div style={{ width: '420px', minHeight: 0, backgroundColor: '#1a1f36', borderRadius: '40px', border: '1px solid #2a3050', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #2a3050', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                                <MessageSquare className="w-4 h-4" style={{ color: '#818cf8' }} />
                            </div>
                            <h3 style={{ fontWeight: 900, color: 'white', margin: 0 }}>Interview Progress</h3>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', scrollBehavior: 'smooth' }}>
                            {/* Status */}
                            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '16px' }}>
                                <p style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Current Status</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', animation: 'pulse 2s infinite' }} />
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80', margin: 0 }}>
                                        {session.isAiSpeaking ? 'Alex Speaking' : 'Listening'}
                                    </p>
                                </div>
                            </div>

                            {/* Tips */}
                            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px' }}>
                                <p style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Tips</p>
                                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
                                    <li>Speak clearly</li>
                                    <li>Pause between thoughts</li>
                                    <li>Answer thoroughly</li>
                                </ul>
                            </div>

                            {/* Self View in Sidebar */}
                            <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Candidate View</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isCameraOff ? '#f59e0b' : '#10b981' }} />
                                        <span style={{ fontSize: '10px', color: isCameraOff ? '#f59e0b' : '#10b981', fontWeight: 900, textTransform: 'uppercase' }}>
                                            {isCameraOff ? 'Camera Off' : 'Live'}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ width: '100%', aspectRatio: '4/3', backgroundColor: '#0a0e1a', borderRadius: '24px', border: '1px solid #2a3050', overflow: 'hidden', position: 'relative' }}>
                                    {!isCameraOff ? (
                                        <WebcamPreview
                                            className="w-full aspect-[4/3]"
                                            onFrame={(frame) => session.sendImage(frame)}
                                            stream={cameraStream || undefined}
                                            frameInterval={1000}
                                        />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b' }}>
                                            <CameraOff className="w-8 h-8 opacity-20" />
                                            <span style={{ fontSize: '12px', fontWeight: 600 }}>Camera Disabled</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Completion Phase
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            {/* Background decoration */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '384px', height: '384px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '50%', filter: 'blur(48px)', marginRight: '-192px', marginTop: '-192px' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '384px', height: '384px', backgroundColor: 'rgba(79, 70, 229, 0.05)', borderRadius: '50%', filter: 'blur(48px)', marginLeft: '-192px', marginBottom: '-192px' }} />

            <div style={{ maxWidth: '768px', width: '100%', position: 'relative', zIndex: 10 }}>
                <div style={{ backgroundColor: '#1a1f36', borderRadius: '48px', border: '1px solid #2a3050', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)', padding: '64px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    {/* Success Icon */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(16, 185, 129, 0.3)', filter: 'blur(32px)', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                            <div style={{ position: 'relative', width: '96px', height: '96px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(16, 185, 129, 0.3)' }}>
                                <CheckCircle className="w-12 h-12" style={{ color: '#4ade80', strokeWidth: 1.5 }} />
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h1 style={{ fontSize: '56px', fontWeight: 900, color: 'white', lineHeight: 1.2, letterSpacing: '-0.02em', margin: 0 }}>
                                Interview <span style={{ color: '#4ade80' }}>Complete!</span>
                            </h1>
                            <p style={{ fontSize: '18px', color: '#64748b', lineHeight: 1.6, maxWidth: '672px', margin: '0 auto', fontWeight: 500 }}>
                                Thank you,{interviewInfo?.candidate_name ? ` ${interviewInfo.candidate_name.split(' ')[0]}` : ''} for your time. Your responses for the <span style={{ color: '#818cf8', fontWeight: 900 }}>{interviewInfo?.job_title}</span> role at <span style={{ color: 'white', fontWeight: 900 }}>{interviewInfo?.company_name}</span> have been recorded and will be reviewed shortly.
                            </p>
                        </div>

                        {/* Info Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '32px', paddingTop: '32px', borderTop: '1px solid #2a3050' }}>
                            <div style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                                <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(79, 70, 229, 0.3)', marginBottom: '16px', margin: '0 auto 16px auto' }}>
                                    <Info className="w-5 h-5" style={{ color: '#818cf8' }} />
                                </div>
                                <h3 style={{ fontWeight: 900, color: 'white', marginBottom: '8px', fontSize: '14px', margin: '0 0 8px 0' }}>What Happens Next?</h3>
                                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
                                    Our team will review the AI assessment and your transcript. You'll hear back within <span style={{ color: 'white', fontWeight: 900 }}>3-5 business days</span>.
                                </p>
                            </div>

                            <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(168, 85, 247, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(168, 85, 247, 0.3)', marginBottom: '16px', margin: '0 auto 16px auto' }}>
                                    <ShieldCheck className="w-5 h-5" style={{ color: '#d8b4fe' }} />
                                </div>
                                <h3 style={{ fontWeight: 900, color: 'white', marginBottom: '8px', fontSize: '14px', margin: '0 0 8px 0' }}>Your Privacy</h3>
                                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
                                    Your data is encrypted and only accessible to authorized recruiters at <span style={{ color: 'white', fontWeight: 900 }}>{interviewInfo?.company_name}</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ borderTop: '1px solid #2a3050', paddingTop: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3em', margin: 0 }}>Session Closed</p>
                        <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 500, margin: 0 }}>
                            You can safely close this window. Thank you for interviewing with us!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
