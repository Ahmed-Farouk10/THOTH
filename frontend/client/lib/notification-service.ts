/**
 * Notification Service
 * Handles real-time notifications from the backend via WebSocket or polling
 */

type EventCallback = (event: { data: any }) => void;

class NotificationService {
  private listeners: Map<string, EventCallback[]> = new Map();
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    // Initialize WebSocket connection when service is created
    // For now, we'll use a simple event emitter pattern
    // WebSocket connection can be added later when backend supports it
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event (for testing or manual triggering)
   */
  emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback({ data });
        } catch (error) {
          console.error(`Error in notification callback for event ${event}:`, error);
        }
      });
    }
  }

  /**
   * Connect to WebSocket server (to be implemented when backend supports it)
   */
  connect(url?: string): void {
    // TODO: Implement WebSocket connection when backend notification service supports it
    // For now, this is a placeholder
    console.log('WebSocket connection not yet implemented');
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    this.listeners.clear();
    this.disconnect();
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

