/**
 * useLiveSession Hook
 * 
 * Manages WebSocket connection for AI Live Voice Interview sessions.
 * Handles audio streaming and transcript updates via interview token.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

export interface TranscriptItem {
    role: 'user' | 'bot';
    content: string;
    timestamp: string;
}

interface UseLiveSessionOptions {
    token: string;
    onTranscriptUpdate?: (transcript: TranscriptItem[]) => void;
    onAudioResponse?: (audioData: string, mimeType: string) => void;
    onError?: (error: string) => void;
    onTurnComplete?: () => void;
    onStatusChange?: (status: string) => void;
}

interface UseLiveSessionReturn {
    isConnected: boolean;
    isConnecting: boolean;
    transcript: TranscriptItem[];
    connect: () => Promise<boolean>;
    disconnect: () => void;
    sendAudio: (pcmData: ArrayBuffer) => void;
    sendImage: (base64Data: string) => void;
    sendText: (text: string) => void;
    error: string | null;
    isAiSpeaking: boolean;
}

export function useLiveSession(options: UseLiveSessionOptions): UseLiveSessionReturn {
    const { token, onTranscriptUpdate, onAudioResponse, onError, onTurnComplete, onStatusChange } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const currentBotTextRef = useRef<string>('');
    const reconnectAttempts = useRef<number>(0);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);

    const connect = useCallback(async (): Promise<boolean> => {
        setIsConnecting(true);
        setError(null);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
            const wsUrl = `${apiUrl.replace(/^http/, 'ws')}/api/interview/${token}/live`;

            console.log('[LiveSession] Connecting to WebSocket:', wsUrl);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            return new Promise((resolve) => {
                ws.onopen = () => {
                    console.log('[LiveSession] WebSocket connected');
                    // Backend automatically handles auth via token in URL and triggers 'connected' message
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        switch (data.type) {
                            case 'connected':
                                setIsConnected(true);
                                setIsConnecting(false);
                                reconnectAttempts.current = 0;
                                resolve(true);
                                break;

                            case 'audio':
                                setIsAiSpeaking(true);
                                onAudioResponse?.(data.data, data.mime_type);
                                break;

                            case 'text':
                                // Accumulate bot text
                                currentBotTextRef.current += data.text;
                                break;

                            case 'transcript_update':
                                // Real-time transcript update from backend
                                setTranscript(data.transcript || []);
                                onTranscriptUpdate?.(data.transcript || []);
                                break;

                            case 'turn_complete':
                                setIsAiSpeaking(false);
                                // Add accumulated bot text to transcript
                                if (currentBotTextRef.current) {
                                    const newItem: TranscriptItem = {
                                        role: 'bot',
                                        content: currentBotTextRef.current,
                                        timestamp: new Date().toISOString(),
                                    };
                                    setTranscript(prev => {
                                        const updated = [...prev, newItem];
                                        onTranscriptUpdate?.(updated);
                                        return updated;
                                    });
                                    currentBotTextRef.current = '';
                                }
                                onTurnComplete?.();
                                break;

                            case 'completed':
                                onStatusChange?.('completed');
                                break;

                            case 'error':
                                setError(data.message);
                                setIsConnecting(false);
                                onError?.(data.message);
                                resolve(false);
                                break;
                        }
                    } catch (e) {
                        console.error('Failed to parse WebSocket message:', e);
                    }
                };

                ws.onerror = (event) => {
                    console.error('[LiveSession] WebSocket error:', event);
                    setError('Connection failed');
                    setIsConnecting(false);
                    setIsConnected(false);
                    resolve(false);
                };

                ws.onclose = (event) => {
                    console.log('[LiveSession] WebSocket closed:', event.code, event.reason);
                    setIsConnected(false);
                    setIsConnecting(false);
                    setIsAiSpeaking(false);

                    if (event.code === 1006 || event.code === 1001) {
                        if (reconnectAttempts.current < 3) {
                            reconnectAttempts.current += 1;
                            console.log(`[LiveSession] Reconnecting... Attempt ${reconnectAttempts.current}/3`);
                            setTimeout(() => {
                                connect().catch(console.error);
                            }, 2000);
                        } else {
                            setError('Connection lost. Please refresh the page to retry.');
                        }
                    }
                };
            });

        } catch (err: any) {
            setError(err.message || 'Failed to connect');
            setIsConnecting(false);
            return false;
        }
    }, [token, onAudioResponse, onTranscriptUpdate, onTurnComplete, onError, onStatusChange]);

    const disconnect = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log('[LiveSession] Ending session...');
            wsRef.current.send(JSON.stringify({ type: 'end' }));
            // Give it a moment to flush before closing
            const currentWs = wsRef.current;
            setTimeout(() => {
                if (currentWs.readyState === WebSocket.OPEN) {
                    currentWs.close();
                }
            }, 500);
        }
        setIsConnected(false);
        setIsAiSpeaking(false);
    }, []);

    const sendAudio = useCallback((pcmData: ArrayBuffer) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // Efficiently convert ArrayBuffer to base64
        const bytes = new Uint8Array(pcmData);
        const binary = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
        const base64 = btoa(binary);

        if (Math.random() < 0.05) { // Log 5% of packets to avoid noise
            console.log(`[LiveSession] Sending audio chunk: ${base64.length} chars (base64)`);
        }

        wsRef.current.send(JSON.stringify({
            type: 'audio',
            data: base64,
        }));
    }, []);

    const sendImage = useCallback((base64Data: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // Strip data URL prefix if present
        const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

        wsRef.current.send(JSON.stringify({
            type: 'image',
            data: base64,
        }));
    }, []);

    const sendText = useCallback((text: string) => {
        // Add user message to transcript (local optimistic update)
        const newItem: TranscriptItem = {
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        };
        setTranscript(prev => {
            const updated = [...prev, newItem];
            onTranscriptUpdate?.(updated);
            return updated;
        });

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'text',
                text,
            }));
        }
    }, [onTranscriptUpdate]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        isConnecting,
        transcript,
        connect,
        disconnect,
        sendAudio,
        sendImage,
        sendText,
        error,
        isAiSpeaking,
    };
}
