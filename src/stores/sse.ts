import { create } from 'zustand';
import type { JobLogEvent } from '../hooks/useSSE';

export type SSEConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

const MAX_LOG_BUFFER = 150;

interface SSEState {
  connectionStatus: SSEConnectionStatus;
  reconnectAttempt: number;
  logBuffer: JobLogEvent[];

  setConnectionStatus: (status: SSEConnectionStatus, attempt?: number) => void;
  addLog: (log: JobLogEvent) => void;
  clearLogs: () => void;
}

export const useSSEStore = create<SSEState>()((set) => ({
  connectionStatus: 'disconnected',
  reconnectAttempt: 0,
  logBuffer: [],

  setConnectionStatus: (status, attempt = 0) =>
    set({ connectionStatus: status, reconnectAttempt: attempt }),

  addLog: (log) =>
    set((state) => {
      const newBuffer = [...state.logBuffer, log];
      if (newBuffer.length > MAX_LOG_BUFFER) {
        return { logBuffer: newBuffer.slice(-MAX_LOG_BUFFER) };
      }
      return { logBuffer: newBuffer };
    }),

  clearLogs: () => set({ logBuffer: [] }),
}));
