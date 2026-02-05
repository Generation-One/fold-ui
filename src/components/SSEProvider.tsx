/**
 * SSE Provider component for real-time notifications.
 *
 * Subscribes to server events and displays toast notifications for:
 * - Job completions and failures
 * - Provider availability changes
 * - Health status changes
 */

import { type ReactNode } from 'react';
import {
  useSSE,
  type JobEvent,
  type JobFailedEvent,
  type ProviderEvent,
  type HealthEvent,
} from '../hooks/useSSE';
import { useToast } from './ToastContext';
import { useAuth } from '../stores/auth';

interface SSEProviderProps {
  children: ReactNode;
}

/** Map job types to human-readable names */
function formatJobType(jobType: string): string {
  const typeMap: Record<string, string> = {
    index_repo: 'Indexing',
    reindex_repo: 'Re-indexing',
    sync_metadata: 'Metadata sync',
    index_history: 'History indexing',
    process_webhook: 'Webhook processing',
    generate_summary: 'Summary generation',
  };
  return typeMap[jobType] || jobType.replace(/_/g, ' ');
}

export function SSEProvider({ children }: SSEProviderProps) {
  const { showToast } = useToast();
  const { token } = useAuth();

  useSSE({
    enabled: !!token,

    onJobStarted: (event: JobEvent) => {
      const jobTypeName = formatJobType(event.job_type);
      const projectInfo = event.project_name ? ` for ${event.project_name}` : '';
      showToast(`${jobTypeName} started${projectInfo}`, 'info');
    },

    onJobCompleted: (event: JobEvent) => {
      const jobTypeName = formatJobType(event.job_type);
      const projectInfo = event.project_name ? ` for ${event.project_name}` : '';
      showToast(`${jobTypeName} completed${projectInfo}`, 'success');
    },

    onJobFailed: (event: JobFailedEvent) => {
      const jobTypeName = formatJobType(event.job_type);
      // Truncate long error messages
      const errorMsg =
        event.error.length > 100 ? event.error.substring(0, 100) + '...' : event.error;
      showToast(`${jobTypeName} failed: ${errorMsg}`, 'error');
    },

    onJobPaused: (event: JobEvent) => {
      const jobTypeName = formatJobType(event.job_type);
      const projectInfo = event.project_name ? ` for ${event.project_name}` : '';
      showToast(`${jobTypeName} paused${projectInfo} - waiting for providers`, 'info');
    },

    onProviderUnavailable: (event: ProviderEvent) => {
      const providerType = event.provider_type.toUpperCase();
      showToast(`${providerType} provider unavailable - jobs may be paused`, 'error');
    },

    onProviderAvailable: (event: ProviderEvent) => {
      const providerType = event.provider_type.toUpperCase();
      showToast(`${providerType} provider restored - resuming jobs`, 'success');
    },

    onHealthChanged: (event: HealthEvent) => {
      if (event.status === 'unhealthy') {
        const msg = event.message || 'System experiencing issues';
        const component = event.component ? `${event.component}: ` : '';
        showToast(`${component}${msg}`, 'error');
      } else if (event.status === 'degraded') {
        const msg = event.message || 'System performance degraded';
        const component = event.component ? `${event.component}: ` : '';
        showToast(`${component}${msg}`, 'info');
      }
      // Don't toast on recovery to healthy - too noisy
    },

    onError: () => {
      // Silent reconnection - don't spam the user with connection errors
      // The hook handles reconnection automatically
      console.warn('SSE connection error, attempting reconnect...');
    },
  });

  return <>{children}</>;
}
