/**
 * SSE (Server-Sent Events) hook for real-time notifications.
 *
 * Uses a singleton EventSource connection shared across all consumers.
 * Subscribes to the /events endpoint and provides typed event handlers.
 * Handles authentication, reconnection with exponential backoff, and cleanup.
 *
 * Connection state and a rolling log buffer are pushed to the SSE Zustand
 * store so that any component (Layout header, Logs page, etc.) can read
 * them without mounting its own SSE subscription.
 */

import { useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useSSEStore } from '../stores/sse';

// Event types matching backend
export type SSEEventType =
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:paused'
  | 'job:resumed'
  | 'job:log'
  | 'indexing:started'
  | 'indexing:progress'
  | 'indexing:completed'
  | 'provider:available'
  | 'provider:unavailable'
  | 'health:changed'
  | 'heartbeat';

// Event payload types
export interface JobEvent {
  job_id: string;
  job_type: string;
  project_id?: string;
  project_name?: string;
  timestamp: string;
}

export interface JobProgressEvent extends JobEvent {
  processed: number;
  failed: number;
  total?: number;
  percent?: number;
}

export interface JobFailedEvent extends JobEvent {
  error: string;
}

export interface IndexingEvent {
  project_id: string;
  project_name: string;
  timestamp: string;
}

export interface IndexingProgressEvent extends IndexingEvent {
  files_indexed: number;
  files_total?: number;
  current_file?: string;
}

export interface ProviderEvent {
  provider_type: 'llm' | 'embedding';
  provider_name: string;
  available: boolean;
  timestamp: string;
}

export interface HealthEvent {
  status: 'healthy' | 'degraded' | 'unhealthy';
  component?: string;
  message?: string;
  timestamp: string;
}

export interface HeartbeatEvent {
  timestamp: string;
}

/** Job log event (admin-only) */
export interface JobLogEvent {
  job_id: string;
  job_type: string;
  project_id?: string;
  project_name?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// Event handler types
type EventHandler<T> = (data: T) => void;

export interface UseSSEOptions {
  // Job events
  onJobStarted?: EventHandler<JobEvent>;
  onJobProgress?: EventHandler<JobProgressEvent>;
  onJobCompleted?: EventHandler<JobEvent>;
  onJobFailed?: EventHandler<JobFailedEvent>;
  onJobPaused?: EventHandler<JobEvent>;
  onJobResumed?: EventHandler<JobEvent>;

  // Indexing events
  onIndexingStarted?: EventHandler<IndexingEvent>;
  onIndexingProgress?: EventHandler<IndexingProgressEvent>;
  onIndexingCompleted?: EventHandler<IndexingEvent>;

  // Provider events
  onProviderAvailable?: EventHandler<ProviderEvent>;
  onProviderUnavailable?: EventHandler<ProviderEvent>;

  // Health events
  onHealthChanged?: EventHandler<HealthEvent>;

  // Job log events (admin-only)
  onJobLog?: EventHandler<JobLogEvent>;

  // Connection events
  onOpen?: () => void;
  onError?: (error: Event) => void;
  onReconnecting?: (attempt: number) => void;

  // Control
  enabled?: boolean;
}

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

// Singleton state for the SSE connection
let singletonEventSource: EventSource | null = null;
let singletonToken: string | null = null;
let singletonReconnectTimeout: number | null = null;
let singletonReconnectAttempts = 0;
let subscriberCount = 0;

// Event emitter for distributing events to all subscribers
type Listener = (data: unknown) => void;
const eventListeners: Map<string, Set<Listener>> = new Map();

function addListener(eventType: string, listener: Listener) {
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, new Set());
  }
  eventListeners.get(eventType)!.add(listener);
}

function removeListener(eventType: string, listener: Listener) {
  eventListeners.get(eventType)?.delete(listener);
}

function emitToListeners(eventType: string, data: unknown) {
  eventListeners.get(eventType)?.forEach(listener => {
    try {
      listener(data);
    } catch (e) {
      console.error(`Error in SSE listener for ${eventType}:`, e);
    }
  });
}

// Connection state listeners
const connectionListeners = {
  open: new Set<() => void>(),
  error: new Set<(error: Event) => void>(),
  reconnecting: new Set<(attempt: number) => void>(),
};

function cleanupSingleton() {
  if (singletonEventSource) {
    singletonEventSource.close();
    singletonEventSource = null;
  }
  if (singletonReconnectTimeout) {
    clearTimeout(singletonReconnectTimeout);
    singletonReconnectTimeout = null;
  }
  singletonToken = null;
  singletonReconnectAttempts = 0;
  useSSEStore.getState().setConnectionStatus('disconnected');
}

function connectSingleton(token: string) {
  // If already connected with same token, do nothing
  if (singletonEventSource && singletonToken === token) {
    return;
  }

  // Clean up any existing connection
  if (singletonEventSource) {
    singletonEventSource.close();
    singletonEventSource = null;
  }
  if (singletonReconnectTimeout) {
    clearTimeout(singletonReconnectTimeout);
    singletonReconnectTimeout = null;
  }

  singletonToken = token;

  // Build SSE URL with token in query string
  const url = `${API_BASE}/events?token=${encodeURIComponent(token)}`;
  const eventSource = new EventSource(url);
  singletonEventSource = eventSource;

  eventSource.onopen = () => {
    singletonReconnectAttempts = 0;
    useSSEStore.getState().setConnectionStatus('connected');
    connectionListeners.open.forEach(cb => cb());
  };

  eventSource.onerror = (error) => {
    connectionListeners.error.forEach(cb => cb(error));

    // Always reconnect while we have subscribers
    if (subscriberCount > 0) {
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * Math.pow(2, singletonReconnectAttempts),
        MAX_RECONNECT_DELAY_MS,
      );
      singletonReconnectAttempts++;

      useSSEStore.getState().setConnectionStatus('reconnecting', singletonReconnectAttempts);
      connectionListeners.reconnecting.forEach(cb => cb(singletonReconnectAttempts));

      singletonReconnectTimeout = window.setTimeout(() => {
        if (subscriberCount > 0 && singletonToken) {
          connectSingleton(singletonToken);
        }
      }, delay);
    } else {
      useSSEStore.getState().setConnectionStatus('disconnected');
    }
  };

  // Register event handlers that distribute to all listeners
  const eventTypes: SSEEventType[] = [
    'job:started', 'job:progress', 'job:completed', 'job:failed',
    'job:paused', 'job:resumed', 'job:log',
    'indexing:started', 'indexing:progress', 'indexing:completed',
    'provider:available', 'provider:unavailable',
    'health:changed', 'heartbeat'
  ];

  for (const eventType of eventTypes) {
    eventSource.addEventListener(eventType, (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const payload = data.data ?? data;
        emitToListeners(eventType, payload);

        // Push job:log events into the background buffer
        if (eventType === 'job:log') {
          useSSEStore.getState().addLog(payload as JobLogEvent);
        }
      } catch (e) {
        console.error(`Failed to parse SSE event ${eventType}:`, e);
      }
    });
  }
}

/**
 * Hook to subscribe to SSE events from the Fold server.
 *
 * Uses a singleton connection - multiple components calling this hook
 * will share the same EventSource connection.
 *
 * Automatically handles:
 * - Authentication via token query parameter
 * - Reconnection with exponential backoff (no limit, capped at 30 s)
 * - Cleanup when all subscribers disconnect
 */
export function useSSE(options: UseSSEOptions = {}) {
  const { token } = useAuth();
  const optionsRef = useRef(options);
  const listenersRef = useRef<Array<{ eventType: string; listener: Listener }>>([]);

  // Keep options ref up to date
  optionsRef.current = options;

  // Subscribe to connection events
  useEffect(() => {
    const onOpen = () => optionsRef.current.onOpen?.();
    const onError = (error: Event) => optionsRef.current.onError?.(error);
    const onReconnecting = (attempt: number) => optionsRef.current.onReconnecting?.(attempt);

    connectionListeners.open.add(onOpen);
    connectionListeners.error.add(onError);
    connectionListeners.reconnecting.add(onReconnecting);

    return () => {
      connectionListeners.open.delete(onOpen);
      connectionListeners.error.delete(onError);
      connectionListeners.reconnecting.delete(onReconnecting);
    };
  }, []);

  // Register event listeners
  useEffect(() => {
    if (options.enabled === false || !token) {
      return;
    }

    // Increment subscriber count and connect if first subscriber
    subscriberCount++;
    connectSingleton(token);

    // Create listeners for each event type
    const listeners: Array<{ eventType: string; listener: Listener }> = [];

    const registerHandler = <T>(
      eventType: SSEEventType,
      getHandler: () => EventHandler<T> | undefined
    ) => {
      const listener: Listener = (data) => {
        const handler = getHandler();
        if (handler) {
          handler(data as T);
        }
      };
      addListener(eventType, listener);
      listeners.push({ eventType, listener });
    };

    // Job events
    registerHandler<JobEvent>('job:started', () => optionsRef.current.onJobStarted);
    registerHandler<JobProgressEvent>('job:progress', () => optionsRef.current.onJobProgress);
    registerHandler<JobEvent>('job:completed', () => optionsRef.current.onJobCompleted);
    registerHandler<JobFailedEvent>('job:failed', () => optionsRef.current.onJobFailed);
    registerHandler<JobEvent>('job:paused', () => optionsRef.current.onJobPaused);
    registerHandler<JobEvent>('job:resumed', () => optionsRef.current.onJobResumed);

    // Indexing events
    registerHandler<IndexingEvent>('indexing:started', () => optionsRef.current.onIndexingStarted);
    registerHandler<IndexingProgressEvent>('indexing:progress', () => optionsRef.current.onIndexingProgress);
    registerHandler<IndexingEvent>('indexing:completed', () => optionsRef.current.onIndexingCompleted);

    // Provider events
    registerHandler<ProviderEvent>('provider:available', () => optionsRef.current.onProviderAvailable);
    registerHandler<ProviderEvent>('provider:unavailable', () => optionsRef.current.onProviderUnavailable);

    // Health events
    registerHandler<HealthEvent>('health:changed', () => optionsRef.current.onHealthChanged);

    // Job log events (admin-only)
    registerHandler<JobLogEvent>('job:log', () => optionsRef.current.onJobLog);

    listenersRef.current = listeners;

    // Cleanup on unmount
    return () => {
      // Remove all listeners
      for (const { eventType, listener } of listeners) {
        removeListener(eventType, listener);
      }
      listenersRef.current = [];

      // Decrement subscriber count and cleanup if no more subscribers
      subscriberCount--;
      if (subscriberCount <= 0) {
        subscriberCount = 0;
        cleanupSingleton();
      }
    };
  }, [token, options.enabled]);

  // Handle token changes - reconnect with new token
  useEffect(() => {
    if (options.enabled === false || !token) {
      return;
    }

    // If token changed, reconnect
    if (singletonToken && singletonToken !== token) {
      connectSingleton(token);
    }
  }, [token, options.enabled]);

  // Expose control methods
  const disconnect = useCallback(() => {
    cleanupSingleton();
  }, []);

  const reconnect = useCallback(() => {
    if (token) {
      connectSingleton(token);
    }
  }, [token]);

  return {
    disconnect,
    reconnect,
  };
}
