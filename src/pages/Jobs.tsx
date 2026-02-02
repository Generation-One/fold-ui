import { useState } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { api } from '../lib/api';
import type { Job } from '../lib/api';
import { EmptyState } from '../components/ui';
import styles from './Jobs.module.css';

type JobStatus = 'all' | 'pending' | 'running' | 'completed' | 'failed' | 'paused';

const STATUS_FILTERS: JobStatus[] = ['all', 'pending', 'running', 'completed', 'failed', 'paused'];
const PAGE_SIZE = 20;

interface JobsResponse {
  jobs: Job[];
  total: number;
  offset: number;
  limit: number;
}

export function Jobs() {
  const [statusFilter, setStatusFilter] = useState<JobStatus>('all');
  const [page, setPage] = useState(0);

  // Fetch jobs with server-side filtering and pagination
  const { data, isLoading, mutate } = useSWR<JobsResponse>(
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

  // Fetch all jobs once to get status counts (lightweight, cached)
  const { data: allJobsData } = useSWR<JobsResponse>(
    'jobs-counts',
    () => api.listJobsFilteredWithMeta({ limit: 1000 }),
    { refreshInterval: 10000 }
  );

  const statusCounts = allJobsData?.jobs?.reduce(
    (acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    },
    { pending: 0, running: 0, completed: 0, failed: 0, paused: 0 } as Record<string, number>
  );

  // Reset to page 0 when filter changes
  const handleFilterChange = (status: JobStatus) => {
    setStatusFilter(status);
    setPage(0);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getJobIcon = (type: string) => {
    switch (type) {
      case 'index':
      case 'codebase_index':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        );
      case 'embed':
      case 'embedding':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
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
      {statusCounts && (
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{jobs?.length || 0}</span>
            <span className={styles.statLabel}>Total Jobs</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{statusCounts.running}</span>
            <span className={styles.statLabel}>Running</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{statusCounts.pending}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{statusCounts.completed}</span>
            <span className={styles.statLabel}>Completed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{statusCounts.failed}</span>
            <span className={styles.statLabel}>Failed</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            className={`${styles.statusChip} ${statusFilter === status ? styles.active : ''}`}
            onClick={() => handleFilterChange(status)}
          >
            {status === 'all' ? 'All' : status}
            {status !== 'all' && statusCounts && (
              <span className={styles.statusCount}>{statusCounts[status] || 0}</span>
            )}
          </button>
        ))}
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
          title={statusFilter === 'all' ? 'No jobs' : `No ${statusFilter} jobs`}
          description="The job queue is empty"
        />
      ) : (
        <>
          <div className={styles.jobList}>
            {jobs?.map((job, index) => (
              <motion.div
                key={job.id}
                className={styles.jobCard}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <div className={styles.jobIcon}>{getJobIcon(job.type)}</div>

                <div className={styles.jobInfo}>
                  <div className={styles.jobType}>{job.type}</div>
                  <div className={styles.jobMeta}>
                    <span className={styles.jobId}>#{job.id.slice(0, 8)}</span>
                    {job.project_id && <span>Project: {job.project_id.slice(0, 8)}</span>}
                    {job.repository_id && <span>Repo: {job.repository_id.slice(0, 8)}</span>}
                  </div>
                  {job.processed_items !== undefined && (
                    <div className={styles.jobProgress}>
                      {job.processed_items} {job.total_items ? `/ ${job.total_items}` : ''} items
                    </div>
                  )}
                  {job.error && <div className={styles.jobError}>{job.error}</div>}
                </div>

                {job.status === 'running' && job.progress !== undefined && (
                  <div className={styles.progressWrapper}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${job.progress * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className={styles.jobStatus}>
                  <span className={`${styles.statusDot} ${styles[job.status]}`} />
                  <span className={`${styles.statusLabel} ${styles[job.status]}`}>
                    {job.status}
                  </span>
                </div>

                <div className={styles.jobTime}>
                  {formatTime(job.created_at)}
                </div>
              </motion.div>
            ))}
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
