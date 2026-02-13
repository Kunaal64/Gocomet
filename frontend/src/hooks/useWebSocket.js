/**
 * Custom hook for WebSocket connection with auto-reconnect
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const isDev = import.meta.env.DEV;
const BACKEND_URL = import.meta.env.VITE_API_URL || '';

function getWsUrl() {
    if (isDev) return 'ws://127.0.0.1:8000/ws';
    if (BACKEND_URL) {
        // Convert https://x.onrender.com → wss://x.onrender.com/ws
        return BACKEND_URL.replace(/^http/, 'ws') + '/ws';
    }
    return `ws://${window.location.host}/ws`;
}
const WS_URL = getWsUrl();

export function useWebSocket(onMessage) {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const onMessageRef = useRef(onMessage);

    // Keep callback ref updated
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                reconnectAttemptsRef.current = 0;
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessageRef.current?.(data);
                } catch (err) {
                    console.error('[WS] Parse error:', err);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                // Exponential backoff reconnect
                const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                reconnectAttemptsRef.current += 1;
                reconnectTimerRef.current = setTimeout(connect, delay);
            };

            ws.onerror = () => setIsConnected(false);

            wsRef.current = ws;
        } catch {
            setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    return { isConnected };
}
