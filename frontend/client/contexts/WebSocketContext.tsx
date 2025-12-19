import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketMessage {
    event_type: string;
    user_id?: string;
    message?: string;
    metadata?: any;
    created_at?: string;
    [key: string]: any;
}

type EventListener = (message: WebSocketMessage) => void;

interface WebSocketContextType {
    isConnected: boolean;
    subscribe: (eventType: string, listener: EventListener) => () => void;
    subscribeAll: (listener: EventListener) => () => void;
    lastMessage: WebSocketMessage | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, token } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const listenersRef = useRef<Map<string, Set<EventListener>>>(new Map());
    const allListenersRef = useRef<Set<EventListener>>(new Set());

    // Subscribe to specific event type
    const subscribe = useCallback((eventType: string, listener: EventListener) => {
        if (!listenersRef.current.has(eventType)) {
            listenersRef.current.set(eventType, new Set());
        }
        listenersRef.current.get(eventType)!.add(listener);

        console.log(`✅ Subscribed to ${eventType} events`);

        // Return unsubscribe function
        return () => {
            listenersRef.current.get(eventType)?.delete(listener);
            console.log(`❌ Unsubscribed from ${eventType} events`);
        };
    }, []);

    // Subscribe to all events
    const subscribeAll = useCallback((listener: EventListener) => {
        allListenersRef.current.add(listener);
        console.log('✅ Subscribed to ALL events');

        return () => {
            allListenersRef.current.delete(listener);
            console.log('❌ Unsubscribed from ALL events');
        };
    }, []);

    // WebSocket connection management
    useEffect(() => {
        if (!token || !user) {
            setIsConnected(false);
            return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname;
        const wsUrl = `${wsProtocol}//${wsHost}/ws/notifications?token=${token}`;

        console.log('🔌 Connecting to WebSocket...');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data);

                // Ignore pong messages
                if (message.type === 'pong') return;

                console.log('📨 WebSocket event:', message.event_type);
                setLastMessage(message);

                // Notify specific event type listeners
                if (message.event_type) {
                    const eventListeners = listenersRef.current.get(message.event_type);
                    if (eventListeners) {
                        eventListeners.forEach(listener => {
                            try {
                                listener(message);
                            } catch (err) {
                                console.error(`Error in ${message.event_type} listener:`, err);
                            }
                        });
                    }
                }

                // Notify all-events listeners
                allListenersRef.current.forEach(listener => {
                    try {
                        listener(message);
                    } catch (err) {
                        console.error('Error in all-events listener:', err);
                    }
                });
            } catch (err) {
                console.error('WebSocket message parse error:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            setIsConnected(false);
        };

        ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            setIsConnected(false);
        };

        // Cleanup
        return () => {
            console.log('Closing WebSocket connection');
            ws.close();
            wsRef.current = null;
        };
    }, [token, user]);

    const value: WebSocketContextType = {
        isConnected,
        subscribe,
        subscribeAll,
        lastMessage,
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = (): WebSocketContextType => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within WebSocketProvider');
    }
    return context;
};
