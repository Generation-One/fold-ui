import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { api } from '../lib/api';
import type { Project, ProjectStatus } from '../lib/api';
import { ProjectSettings } from '../components/ProjectSettings';
import { ProjectMemberManager } from '../components/ProjectMemberManager';
import styles from './ProjectDetail.module.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function ProjectStatusPanel({ projectId }: { projectId: string }) {
  const { data: status, isLoading, error } = useSWR<ProjectStatus>(
    `project-status-${projectId}`,
    () => api.getProjectStatus(projectId),
    { refreshInterval: 10000 }
  );

  if (isLoading) {
    return (
      <div className={styles.statusLoading}>
        <div className={styles.spinner}></div>
        <p>Loading status...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className={styles.statusError}>
        <p>Failed to load project status</p>
      </div>
    );
  }

  return (
    <div className={styles.statusPanel}>
      <div className={styles.statusGrid}>
      {/* Health Overview */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Health</h3>
          <span className={`${styles.healthBadge} ${styles[status.health.status]}`}>
            {status.health.status}
          </span>
        </div>
        <div className={styles.statusCardBody}>
          <div className={styles.healthChecks}>
            <div className={styles.healthCheck}>
              <span className={status.health.accessible ? styles.checkOk : styles.checkFail}>
                {status.health.accessible ? '✓' : '✗'}
              </span>
              <span>Root path accessible</span>
            </div>
            <div className={styles.healthCheck}>
              <span className={status.health.vector_collection_exists ? styles.checkOk : styles.checkFail}>
                {status.health.vector_collection_exists ? '✓' : '✗'}
              </span>
              <span>Vector collection</span>
            </div>
            <div className={styles.healthCheck}>
              <span className={!status.health.has_recent_failures ? styles.checkOk : styles.checkFail}>
                {!status.health.has_recent_failures ? '✓' : '✗'}
              </span>
              <span>No recent failures</span>
            </div>
            {status.health.indexing_in_progress && (
              <div className={styles.healthCheck}>
                <span className={styles.checkProgress}>⟳</span>
                <span>Indexing in progress</span>
              </div>
            )}
          </div>
          {status.health.issues.length > 0 && (
            <div className={styles.healthIssues}>
              {status.health.issues.map((issue, i) => (
                <div key={i} className={styles.healthIssue}>
                  <span className={styles.issueIcon}>⚠</span>
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Database Stats */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Database</h3>
        </div>
        <div className={styles.statusCardBody}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.database.total_memories}</span>
            <span className={styles.statLabel}>Memories</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.database.total_chunks}</span>
            <span className={styles.statLabel}>Chunks</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.database.total_links}</span>
            <span className={styles.statLabel}>Links</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{formatBytes(status.database.estimated_size_bytes)}</span>
            <span className={styles.statLabel}>Est. Size</span>
          </div>
        </div>
        <div className={styles.memoryBreakdown}>
          <h4 className={styles.breakdownTitle}>By Type</h4>
          <div className={styles.breakdownGrid}>
            {Object.entries(status.database.memories_by_type).map(([type, count]) => (
              count > 0 && (
                <div key={type} className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>{type}</span>
                  <span className={styles.breakdownValue}>{count}</span>
                </div>
              )
            ))}
          </div>
          <h4 className={styles.breakdownTitle}>By Source</h4>
          <div className={styles.breakdownGrid}>
            {Object.entries(status.database.memories_by_source).map(([source, count]) => (
              count > 0 && (
                <div key={source} className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>{source}</span>
                  <span className={styles.breakdownValue}>{count}</span>
                </div>
              )
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Vector DB Stats */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Vector Database</h3>
        </div>
        <div className={styles.statusCardBody}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.vector_db.total_vectors}</span>
            <span className={styles.statLabel}>Vectors</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.vector_db.dimension}</span>
            <span className={styles.statLabel}>Dimensions</span>
          </div>
          <div className={styles.statItem}>
            <span className={status.vector_db.sync_status.in_sync ? styles.statValueOk : styles.statValueWarn}>
              {status.vector_db.sync_status.in_sync ? 'Synced' : `${status.vector_db.sync_status.difference > 0 ? '+' : ''}${status.vector_db.sync_status.difference}`}
            </span>
            <span className={styles.statLabel}>Sync Status</span>
          </div>
        </div>
        <div className={styles.collectionInfo}>
          <code className={styles.collectionName}>{status.vector_db.collection_name}</code>
        </div>
        </div>
      </div>

      {/* Jobs Stats */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Jobs</h3>
        </div>
        <div className={styles.statusCardBody}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.jobs.running}</span>
            <span className={styles.statLabel}>Running</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.jobs.pending}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.jobs.completed_24h}</span>
            <span className={styles.statLabel}>Done (24h)</span>
          </div>
          <div className={styles.statItem}>
            <span className={status.jobs.failed_24h === 0 ? styles.statValue : styles.statValueError}>
              {status.jobs.failed_24h}
            </span>
            <span className={styles.statLabel}>Failed (24h)</span>
          </div>
        </div>
        {status.recent_jobs.length > 0 && (
          <div className={styles.recentJobs}>
            <h4 className={styles.breakdownTitle}>Recent</h4>
            {status.recent_jobs.slice(0, 5).map((job) => (
              <div key={job.id} className={styles.recentJob}>
                <span className={`${styles.jobStatus} ${styles[`job_${job.status}`]}`} />
                <span className={styles.jobType}>{job.job_type.replace(/_/g, ' ')}</span>
                <span className={styles.jobTime}>
                  {job.completed_at ? formatTimeAgo(job.completed_at) : formatTimeAgo(job.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Filesystem Stats */}
      {status.filesystem && (
        <div className={styles.statusCard}>
          <div className={styles.statusCardHeader}>
            <h3 className={styles.statusCardTitle}>Filesystem</h3>
          </div>
          <div className={styles.statusCardBody}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={status.filesystem.root_exists ? styles.statValueOk : styles.statValueError}>
                {status.filesystem.root_exists ? 'Yes' : 'No'}
              </span>
              <span className={styles.statLabel}>Root Exists</span>
            </div>
            <div className={styles.statItem}>
              <span className={status.filesystem.fold_dir_exists ? styles.statValueOk : styles.statValueWarn}>
                {status.filesystem.fold_dir_exists ? 'Yes' : 'No'}
              </span>
              <span className={styles.statLabel}>fold/ Dir</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>~{status.filesystem.indexable_files_estimate}</span>
              <span className={styles.statLabel}>Indexable Files</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{formatBytes(status.filesystem.fold_dir_size_bytes)}</span>
              <span className={styles.statLabel}>fold/ Size</span>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Indexing Status */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Indexing</h3>
        </div>
        <div className={styles.statusCardBody}>
        {status.indexing.in_progress ? (
          <div className={styles.indexingProgress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${status.indexing.progress || 0}%` }}
              />
            </div>
            <span className={styles.progressText}>
              {status.indexing.progress !== undefined ? `${status.indexing.progress}%` : 'Processing...'}
            </span>
          </div>
        ) : (
          <div className={styles.indexingInfo}>
            {status.indexing.last_indexed_at ? (
              <>
                <div className={styles.indexStat}>
                  <span className={styles.indexLabel}>Last indexed</span>
                  <span className={styles.indexValue}>{formatTimeAgo(status.indexing.last_indexed_at)}</span>
                </div>
                {status.indexing.last_duration_secs && (
                  <div className={styles.indexStat}>
                    <span className={styles.indexLabel}>Duration</span>
                    <span className={styles.indexValue}>{formatDuration(status.indexing.last_duration_secs)}</span>
                  </div>
                )}
              </>
            ) : (
              <span className={styles.neverIndexed}>Never indexed</span>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Timestamps */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Timeline</h3>
        </div>
        <div className={styles.statusCardBody}>
        <div className={styles.timeline}>
          <div className={styles.timelineItem}>
            <span className={styles.timelineLabel}>Created</span>
            <span className={styles.timelineValue}>{new Date(status.timestamps.created_at).toLocaleString()}</span>
          </div>
          {status.timestamps.last_indexed_at && (
            <div className={styles.timelineItem}>
              <span className={styles.timelineLabel}>Last Indexed</span>
              <span className={styles.timelineValue}>{formatTimeAgo(status.timestamps.last_indexed_at)}</span>
            </div>
          )}
          {status.timestamps.last_memory_created_at && (
            <div className={styles.timelineItem}>
              <span className={styles.timelineLabel}>Last Memory</span>
              <span className={styles.timelineValue}>{formatTimeAgo(status.timestamps.last_memory_created_at)}</span>
            </div>
          )}
          {status.timestamps.last_job_completed_at && (
            <div className={styles.timelineItem}>
              <span className={styles.timelineLabel}>Last Job Done</span>
              <span className={styles.timelineValue}>{formatTimeAgo(status.timestamps.last_job_completed_at)}</span>
            </div>
          )}
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function ProjectInfo({ project }: { project: Project }) {
  const isRemote = project.provider !== 'local';

  return (
    <div className={styles.infoPanel}>
      <div className={styles.infoSection}>
        <h3 className={styles.sectionTitle}>Provider</h3>
        <div className={styles.providerInfo}>
          {project.provider === 'github' ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          ) : project.provider === 'gitlab' ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          )}
          <span className={styles.providerName}>
            {project.provider === 'local' ? 'Local filesystem' : project.provider === 'github' ? 'GitHub' : 'GitLab'}
          </span>
        </div>
      </div>

      <div className={styles.infoSection}>
        <h3 className={styles.sectionTitle}>Root Path</h3>
        <code className={styles.pathValue}>{project.root_path}</code>
      </div>

      {isRemote && (
        <div className={styles.infoSection}>
          <h3 className={styles.sectionTitle}>Remote Repository</h3>
          <div className={styles.remoteInfo}>
            <span className={styles.remoteName}>{project.remote_owner}/{project.remote_repo}</span>
            {project.remote_branch && (
              <span className={styles.branchBadge}>{project.remote_branch}</span>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function AdvancedSettings({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    if (!confirm('This will permanently delete all memories, chunks, and associated data. Type DELETE to confirm.')) return;

    setDeleting(true);
    try {
      await api.deleteProject(projectId);
      navigate('/projects');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
      setDeleting(false);
    }
  };

  return (
    <div className={styles.advancedPanel}>
      <div className={styles.dangerZone}>
        <h3 className={styles.dangerTitle}>Danger Zone</h3>
        <div className={styles.dangerCard}>
          <div className={styles.dangerContent}>
            <h4>Delete this project</h4>
            <p>Once you delete a project, there is no going back. This will permanently delete all memories, chunks, links, and associated data.</p>
          </div>
          <button
            className={styles.dangerBtn}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'status' | 'info' | 'weights' | 'members' | 'advanced'>('status');
  const [indexing, setIndexing] = useState(false);
  const [syncingCommits, setSyncingCommits] = useState(false);

  const { data: project, isLoading, error } = useSWR<Project>(
    projectId ? `project-${projectId}` : null,
    () => (projectId ? api.getProject(projectId) : Promise.reject())
  );

  const handleIndex = async () => {
    if (!project) return;
    const isRemote = project.provider !== 'local';
    if (!confirm(isRemote ? 'Reindex will re-process all files. Continue?' : 'Scan and index all files in this project?')) return;
    setIndexing(true);
    try {
      await api.reindexProject(project.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to index');
    } finally {
      setIndexing(false);
    }
  };

  const handleSyncCommits = async () => {
    if (!project) return;
    setSyncingCommits(true);
    try {
      await api.syncCommits(project.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sync commits');
    } finally {
      setSyncingCommits(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={styles.error}>
        <h2>Project not found</h2>
        <button onClick={() => navigate('/projects')} className={styles.backBtn}>
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Compact Header */}
      <div className={styles.compactHeader}>
        <button onClick={() => navigate('/projects')} className={styles.backBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.titleSection}>
          <h1 className={styles.projectName}>{project.name}</h1>
          <p className={styles.projectSlug}>{project.slug}</p>
        </div>
        <button
          className={styles.headerActionBtn}
          onClick={handleIndex}
          disabled={indexing}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
          </svg>
          {indexing
            ? (project.provider !== 'local' ? 'Reindexing...' : 'Scanning...')
            : (project.provider !== 'local' ? 'Reindex' : 'Scan & Index')}
        </button>
        {project.provider !== 'local' && (
          <button
            className={styles.headerActionBtn}
            onClick={handleSyncCommits}
            disabled={syncingCommits}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <line x1="1.05" y1="12" x2="7" y2="12" />
              <line x1="17.01" y1="12" x2="22.96" y2="12" />
            </svg>
            {syncingCommits ? 'Syncing...' : 'Sync Commits'}
          </button>
        )}
      </div>

      {project.description && (
        <p className={styles.description}>{project.description}</p>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'status' ? styles.active : ''}`}
          onClick={() => setTab('status')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          Status
        </button>
        <button
          className={`${styles.tab} ${tab === 'info' ? styles.active : ''}`}
          onClick={() => setTab('info')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          Info
        </button>
        <button
          className={`${styles.tab} ${tab === 'members' ? styles.active : ''}`}
          onClick={() => setTab('members')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          Members
        </button>
        <button
          className={`${styles.tab} ${tab === 'weights' ? styles.active : ''}`}
          onClick={() => setTab('weights')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" />
          </svg>
          Weights & Bias
        </button>
        <button
          className={`${styles.tab} ${tab === 'advanced' ? styles.active : ''}`}
          onClick={() => setTab('advanced')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Advanced
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {tab === 'status' && <ProjectStatusPanel projectId={projectId!} />}
        {tab === 'info' && <ProjectInfo project={project} />}
        {tab === 'members' && (
          <ProjectMemberManager projectId={projectId!} />
        )}
        {tab === 'weights' && <ProjectSettings projectId={projectId!} />}
        {tab === 'advanced' && <AdvancedSettings projectId={projectId!} />}
      </div>
    </motion.div>
  );
}
