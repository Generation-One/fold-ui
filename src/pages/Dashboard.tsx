import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { api } from '../lib/api';
import type { SystemStatus, Job } from '../lib/api';
import { useAuth } from '../stores/auth';
import styles from './Dashboard.module.css';

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatJobType(type: string): string {
  const types: Record<string, string> = {
    index_repo: 'Index Repository',
    reindex_repo: 'Reindex Repository',
    index_history: 'Index History',
    sync_metadata: 'Sync Metadata',
    process_webhook: 'Process Webhook',
    generate_summary: 'Generate Summary',
  };
  return types[type] || type.replace(/_/g, ' ');
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function StatCard({
  value,
  label,
  delay = 0,
}: {
  value: string | number;
  label: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.statCard}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
      </div>
    </motion.div>
  );
}

function StatusItem({
  name,
  detail,
  connected,
  icon,
}: {
  name: string;
  detail: string;
  connected: boolean;
  icon: ReactNode;
}) {
  return (
    <div className={styles.statusItem}>
      <div className={`${styles.statusItemIcon} ${connected ? '' : styles.warning}`}>
        {icon}
      </div>
      <div className={styles.statusItemInfo}>
        <div className={styles.statusItemName}>{name}</div>
        <div className={styles.statusItemDetail}>{detail}</div>
      </div>
    </div>
  );
}

function JobItem({ job }: { job: Job }) {
  return (
    <div className={styles.jobItem}>
      <span className={`${styles.jobStatus} ${styles[job.status]}`} />
      <span className={styles.jobType}>{formatJobType(job.type)}</span>
      <span className={styles.jobProject}>{job.project_id || 'System'}</span>
      <span className={styles.jobTime}>{formatTime(job.created_at)}</span>
    </div>
  );
}

export function Dashboard() {
  const { isAuthenticated } = useAuth();

  const { data: status } = useSWR<SystemStatus>(
    'status',
    api.getStatus,
    { refreshInterval: 5000 }
  );

  const { data: jobs = [] } = useSWR<Job[]>(
    'jobs',
    api.getJobs,
    { refreshInterval: 5000 }
  );

  const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'running');

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSubtitle}>System overview and recent activity</p>
      </div>

      <div className={styles.grid}>
        {/* Stat Cards */}
        <StatCard
          value={formatNumber(status?.qdrant?.total_points || 0)}
          label="Vector Points"
          delay={0.1}
        />
        <StatCard
          value={status?.qdrant?.collections || 0}
          label="Collections"
          delay={0.15}
        />
        <StatCard
          value={status?.embeddings?.dimension || 384}
          label="Embedding Dim"
          delay={0.2}
        />
        <StatCard
          value={formatNumber(status?.metrics?.total_requests || 0)}
          label="Total Requests"
          delay={0.25}
        />

        {/* System Status */}
        <motion.div
          className={`${styles.card} ${styles.wideCard}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>System Status</span>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.statusGrid}>
              <StatusItem
                name="SQLite Database"
                detail={
                  status?.database?.connected
                    ? `Pool: ${status.database.pool_size} connections`
                    : 'Disconnected'
                }
                connected={status?.database?.connected ?? false}
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                }
              />
              <StatusItem
                name="Qdrant Vectors"
                detail={
                  status?.qdrant?.connected
                    ? `${status.qdrant.collections} collections`
                    : 'Disconnected'
                }
                connected={status?.qdrant?.connected ?? false}
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                }
              />
              <StatusItem
                name="Embeddings"
                detail={
                  status?.embeddings?.loaded
                    ? status.embeddings.model.split('/').pop() || 'Loaded'
                    : 'Not loaded'
                }
                connected={status?.embeddings?.loaded ?? false}
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                }
              />
            </div>
          </div>
        </motion.div>

        {/* Jobs Panel */}
        <motion.div
          className={`${styles.card} ${styles.wideCard}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Job Queue</span>
            <span className={styles.cardMeta}>
              {activeJobs.length > 0
                ? `${activeJobs.length} active`
                : 'No active jobs'}
            </span>
          </div>
          <div className={styles.cardContent}>
            {jobs.length === 0 ? (
              <div className={styles.emptyState}>
                <svg
                  className={styles.emptyIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div className={styles.emptyTitle}>Queue is empty</div>
                <div className={styles.emptyDesc}>No pending or running jobs</div>
              </div>
            ) : (
              <div className={styles.jobList}>
                {jobs.slice(0, 8).map((job) => (
                  <JobItem key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          className={`${styles.card} ${styles.wideCard}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Quick Stats</span>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.quickStats}>
              <div className={styles.quickStatItem}>
                <span className={styles.quickStatValue}>
                  {status?.jobs?.pending || 0}
                </span>
                <span className={styles.quickStatLabel}>Pending Jobs</span>
              </div>
              <div className={styles.quickStatItem}>
                <span className={styles.quickStatValue}>
                  {status?.jobs?.running || 0}
                </span>
                <span className={styles.quickStatLabel}>Running Jobs</span>
              </div>
              <div className={styles.quickStatItem}>
                <span className={styles.quickStatValue}>
                  {status?.jobs?.failed_24h || 0}
                </span>
                <span className={styles.quickStatLabel}>Failed (24h)</span>
              </div>
              <div className={styles.quickStatItem}>
                <span className={styles.quickStatValue}>
                  {status?.metrics?.total_errors || 0}
                </span>
                <span className={styles.quickStatLabel}>Total Errors</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Auth Notice */}
        {!isAuthenticated && (
          <motion.div
            className={`${styles.card} ${styles.wideCard} ${styles.noticeCard}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.cardContent}>
              <div className={styles.noticeContent}>
                <svg
                  className={styles.noticeIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <div>
                  <h3 className={styles.noticeTitle}>Authentication Required</h3>
                  <p className={styles.noticeDesc}>
                    To access projects and memories, you need to authenticate. Go to{' '}
                    <a href="/settings">Settings</a> to configure your API token.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}
