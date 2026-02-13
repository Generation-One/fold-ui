import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { api } from '../lib/api';
import type { Job, JobStatusCounts } from '../lib/api';
import { EmptyState } from '../components/ui';
import styles from './Jobs.module.css';

type JobFilter = 'active' | 'all' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

const STATUS_FILTERS: JobFilter[] = ['active', 'all', 'pending', 'running', 'completed', 'failed', 'cancelled', 'paused'];
const PAGE_SIZE = 20;

const JOB_TYPE_LABELS: Record<string, string> = {
  index_repo: 'Index Repository',
  reindex_repo: 'Reindex Repository',
  index_history: 'Index History',
  sync_metadata: 'Sync Metadata',
  process_webhook: 'Process Webhook',
  generate_summary: 'Generate Summary',
  sync_commits: 'Sync Commits',
  custom: 'Custom',
};

interface JobsPageResponse {
  jobs: Job[];
  total: number;
  offset: number;
  limit: number;
  counts: JobStatusCounts;
}

function formatJobType(type: string): string {
  return JOB_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function getJobDuration(job: Job): string | null {
  if (!job.started_at) return null;
  const start = new Date(job.started_at).getTime();
  if (job.completed_at) {
    return formatDuration(new Date(job.completed_at).getTime() - start);
  }
  if (job.status === 'running') {
    return formatDuration(Date.now() - start);
  }
  return null;
}

function getFilterCount(counts: JobStatusCounts, filter: JobFilter): number {
  switch (filter) {
    case 'active': return counts.pending + counts.running + counts.retry + counts.paused;
    case 'all': return counts.total;
    case 'pending': return counts.pending;
    case 'running': return counts.running;
    case 'completed': return counts.completed;
    case 'failed': return counts.failed;
    case 'cancelled': return counts.cancelled;
    case 'paused': return counts.paused;
    default: return 0;
  }
}

export function Jobs() {
  const [statusFilter, setStatusFilter] = useState<JobFilter>('active');
  const [page, setPage] = useState(0);

  // Fetch jobs with server-side filtering and pagination
  // The backend now returns counts in every response
  const { data, isLoading, mutate } = useSWR<JobsPageResponse>(
    ['jobs', statusFilter, page],
    async () => {
      const result = await api.listJobsFilteredWithMeta({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      return result;
    },
    { refreshInterval: 5000 }
  );

  const jobs = data?.jobs;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const counts = data?.counts;

  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  // Reset to page 0 when filter changes
  const handleFilterChange = (status: JobFilter) => {
    setStatusFilter(status);
    setPage(0);
  };

  const handleCancelJob = async (jobId: string) => {
    setCancellingIds(prev => new Set(prev).add(jobId));
    try {
      await api.cancelJob(jobId);
      mutate();
    } catch {
      mutate();
    } finally {
      setCancellingIds(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const isCancellable = (status: string) =>
    ['pending', 'running', 'retry', 'paused'].includes(status);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getJobIcon = (type: string) => {
    switch (type) {
      case 'index_repo':
      case 'reindex_repo':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        );
      case 'index_history':
      case 'sync_commits':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'sync_metadata':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        );
      case 'generate_summary':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        );
      case 'process_webhook':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
          </svg>
        );
    }
  };

  // Re-render running job durations every second
  const [, setTick] = useState(0);
  const hasRunning = jobs?.some(j => j.status === 'running' && j.started_at);
  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Jobs</h1>
          <p className={styles.pageSubtitle}>Background job queue status</p>
        </div>
        <button
          className={`${styles.refreshBtn} ${isLoading ? styles.spinning : ''}`}
          onClick={() => mutate()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      {counts && (
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{counts.total}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.statRunning}`}>{counts.running}</span>
            <span className={styles.statLabel}>Running</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.statPending}`}>{counts.pending + counts.retry + counts.paused}</span>
            <span className={styles.statLabel}>Queued</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.statCompleted}`}>{counts.completed}</span>
            <span className={styles.statLabel}>Completed</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.statFailed}`}>{counts.failed}</span>
            <span className={styles.statLabel}>Failed</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        {STATUS_FILTERS.map((status) => {
          const count = counts ? getFilterCount(counts, status) : undefined;
          return (
            <button
              key={status}
              className={`${styles.statusChip} ${statusFilter === status ? styles.active : ''}`}
              onClick={() => handleFilterChange(status)}
            >
              {status === 'active' ? 'Active' : status === 'all' ? 'All' : status}
              {count !== undefined && (
                <span className={styles.statusCount}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className={styles.loading}>Loading jobs...</div>
      ) : jobs?.length === 0 ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
            </svg>
          }
          title={statusFilter === 'all' ? 'No jobs' : statusFilter === 'active' ? 'No active jobs' : `No ${statusFilter} jobs`}
          description={statusFilter === 'active' ? 'Nothing is currently queued or running' : 'The job queue is empty'}
        />
      ) : (
        <>
          <div className={styles.jobList}>
            {jobs?.map((job, index) => {
              const duration = getJobDuration(job);
              const progressPct = job.progress !== undefined ? Math.round(job.progress * 100) : null;

              return (
                <motion.div
                  key={job.id}
                  className={styles.jobCard}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                >
                  <div className={`${styles.jobIcon} ${styles[`icon_${job.status}`] || ''}`}>{getJobIcon(job.type)}</div>

                  <div className={styles.jobInfo}>
                    <div className={styles.jobHeader}>
                      <span className={styles.jobType}>{formatJobType(job.type)}</span>
                      {job.project_name && (
                        <span className={styles.projectName}>{job.project_name}</span>
                      )}
                    </div>
                    <div className={styles.jobMeta}>
                      <span className={styles.jobId}>#{job.id.slice(0, 8)}</span>
                      <span className={styles.jobMetaSep}>&middot;</span>
                      <span>Created {formatTime(job.created_at)}</span>
                      {job.started_at && (
                        <>
                          <span className={styles.jobMetaSep}>&middot;</span>
                          <span>Started {formatTime(job.started_at)}</span>
                        </>
                      )}
                      {duration && (
                        <>
                          <span className={styles.jobMetaSep}>&middot;</span>
                          <span className={styles.jobDuration}>{duration}</span>
                        </>
                      )}
                    </div>

                    {/* Progress */}
                    {(job.processed_items !== undefined && job.processed_items > 0 || job.total_items) && (
                      <div className={styles.progressRow}>
                        {job.total_items ? (
                          <>
                            <div className={styles.progressBarWide}>
                              <div
                                className={`${styles.progressFill} ${job.status === 'failed' ? styles.progressFailed : ''}`}
                                style={{ width: `${progressPct ?? 0}%` }}
                              />
                            </div>
                            <span className={styles.progressText}>
                              {job.processed_items ?? 0} / {job.total_items}
                              {progressPct !== null && ` (${progressPct}%)`}
                            </span>
                          </>
                        ) : (
                          <span className={styles.progressText}>
                            {job.processed_items} items processed
                          </span>
                        )}
                      </div>
                    )}

                    {/* Retry info */}
                    {job.retry_count !== undefined && job.retry_count > 0 && (
                      <div className={styles.retryInfo}>
                        Retry {job.retry_count}{job.max_retries ? ` / ${job.max_retries}` : ''}
                      </div>
                    )}

                    {job.error && <div className={styles.jobError}>{job.error}</div>}
                  </div>

                  <div className={styles.jobStatus}>
                    <span className={`${styles.statusDot} ${styles[job.status]}`} />
                    <span className={`${styles.statusLabel} ${styles[job.status]}`}>
                      {job.status}
                    </span>
                  </div>

                  {isCancellable(job.status) && (
                    <button
                      className={styles.cancelBtn}
                      onClick={() => handleCancelJob(job.id)}
                      disabled={cancellingIds.has(job.id)}
                      title="Cancel job"
                    >
                      {cancellingIds.has(job.id) ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        </svg>
                      )}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Previous
              </button>

              <span className={styles.pageInfo}>
                Page {page + 1} of {totalPages} ({total} jobs)
              </span>

              <button
                className={styles.pageBtn}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
