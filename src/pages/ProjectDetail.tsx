import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import type { Project, ProjectStatus, GitHubBranch } from '../lib/api';
import { ProjectSettings } from '../components/ProjectSettings';
import { ProjectMemberManager } from '../components/ProjectMemberManager';
import styles from './ProjectDetail.module.css';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number | undefined | null): string {
  if (seconds == null || seconds === 0) return '--';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTimeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '--';
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getRemoteUrl(project: { provider: string; remote_owner?: string; remote_repo?: string }): string | null {
  if (!project.remote_owner || !project.remote_repo) return null;
  if (project.provider === 'github') return `https://github.com/${project.remote_owner}/${project.remote_repo}`;
  if (project.provider === 'gitlab') return `https://gitlab.com/${project.remote_owner}/${project.remote_repo}`;
  return null;
}

function embeddedPercent(syncStatus: ProjectStatus['vector_db']['sync_status']): number {
  if (syncStatus.in_sync) return 100;
  if (!syncStatus.expected_count || syncStatus.expected_count === 0) return 0;
  return Math.min(100, Math.round((syncStatus.vector_count / syncStatus.expected_count) * 100));
}

function indexedPercent(filesystem: ProjectStatus['filesystem']): number {
  if (!filesystem || !filesystem.root_exists) return 0;
  if (filesystem.indexable_files_estimate === 0) return 0;
  return Math.min(100, Math.round((filesystem.indexed_files_count / filesystem.indexable_files_estimate) * 100));
}

function ProjectStatusPanel({ projectId }: { projectId: string }) {
  const { data: status, isLoading, error } = useSWR<ProjectStatus>(
    `project-status-${projectId}`,
    () => api.getProjectStatus(projectId),
    { refreshInterval: 5000 }
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

  const pct = embeddedPercent(status.vector_db.sync_status);
  const activeJobs = status.jobs.running + status.jobs.pending;

  return (
    <div className={styles.statusPanel}>
      <div className={styles.statusGrid}>
      {/* Health Overview - now includes job counts */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Health</h3>
          <div className={styles.headerBadges}>
            {activeJobs > 0 && (
              <span className={styles.jobCountBadge}>
                {status.jobs.running > 0 && <span className={styles.runningDot} />}
                {activeJobs} job{activeJobs !== 1 ? 's' : ''}
              </span>
            )}
            <span className={`${styles.healthBadge} ${styles[status.health.status]}`}>
              {status.health.status}
            </span>
          </div>
        </div>
        <div className={styles.statusCardBody}>
          <div className={styles.healthChecks}>
            <div className={styles.healthCheck}>
              <span className={status.health.accessible ? styles.checkOk : styles.checkFail}>
                {status.health.accessible ? '\u2713' : '\u2717'}
              </span>
              <span>Root path accessible</span>
            </div>
            <div className={styles.healthCheck}>
              <span className={status.health.vector_collection_exists ? styles.checkOk : styles.checkFail}>
                {status.health.vector_collection_exists ? '\u2713' : '\u2717'}
              </span>
              <span>Vector collection</span>
            </div>
            <div className={styles.healthCheck}>
              <span className={!status.health.has_recent_failures ? styles.checkOk : styles.checkFail}>
                {!status.health.has_recent_failures ? '\u2713' : '\u2717'}
              </span>
              <span>No recent failures</span>
            </div>
            {status.health.indexing_in_progress && (
              <div className={styles.healthCheck}>
                <span className={styles.checkProgress}>{'\u27F3'}</span>
                <span>Indexing in progress</span>
              </div>
            )}
          </div>
          {/* Job summary within health */}
          {(status.jobs.completed_24h > 0 || status.jobs.failed_24h > 0) && (
            <div className={styles.jobSummary}>
              <span className={styles.jobSummaryItem}>
                {status.jobs.completed_24h} completed
              </span>
              {status.jobs.failed_24h > 0 && (
                <span className={`${styles.jobSummaryItem} ${styles.jobSummaryError}`}>
                  {status.jobs.failed_24h} failed
                </span>
              )}
              <span className={styles.jobSummaryLabel}>past 24h</span>
            </div>
          )}
          {status.health.issues.length > 0 && (
            <div className={styles.healthIssues}>
              {status.health.issues.map((issue, i) => (
                <div key={i} className={styles.healthIssue}>
                  <span className={styles.issueIcon}>{'\u26A0'}</span>
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Indexing & Files - merged card */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Indexing</h3>
          {status.indexing.in_progress && (
            <span className={styles.indexingBadge}>In Progress</span>
          )}
        </div>
        <div className={styles.statusCardBody}>
        {/* Big percentage hero */}
        {(() => {
          const idxPct = indexedPercent(status.filesystem);
          return (
            <div className={styles.indexHero}>
              <span className={idxPct === 100 ? styles.indexHeroValueOk : idxPct > 0 ? styles.indexHeroValueWarn : styles.indexHeroValue}>
                {idxPct}%
              </span>
              <span className={styles.indexHeroLabel}>Files Indexed</span>
              {status.filesystem && status.filesystem.root_exists && (
                <span className={styles.indexHeroDetail}>
                  {status.filesystem.indexed_files_count.toLocaleString()} / {status.filesystem.indexable_files_estimate.toLocaleString()} files
                </span>
              )}
              {idxPct < 100 && idxPct > 0 && (
                <div className={styles.indexHeroBar}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${idxPct}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Active indexing progress */}
        {status.indexing.in_progress && (
          <div className={styles.indexingActiveProgress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${status.indexing.progress || 0}%` }}
              />
            </div>
            <span className={styles.progressText}>
              {status.indexing.progress != null && status.indexing.progress > 0
                ? `Current job: ${status.indexing.progress}%`
                : 'Starting...'}
            </span>
          </div>
        )}

        {/* Stats below */}
        <div className={styles.filesystemInline}>
          <div className={styles.fileStatRow}>
            <span className={styles.indexLabel}>Last indexed</span>
            <span className={styles.indexValue}>{formatTimeAgo(status.indexing.last_indexed_at)}</span>
          </div>
          <div className={styles.fileStatRow}>
            <span className={styles.indexLabel}>Duration</span>
            <span className={styles.indexValue}>{formatDuration(status.indexing.last_duration_secs)}</span>
          </div>
          <div className={styles.fileStatRow}>
            <span className={styles.indexLabel}>Memories</span>
            <span className={styles.indexValue}>{status.database.total_memories.toLocaleString()}</span>
          </div>
          {status.filesystem?.fold_dir_exists && (
            <div className={styles.fileStatRow}>
              <span className={styles.indexLabel}>fold/ size</span>
              <span className={styles.indexValue}>{formatBytes(status.filesystem.fold_dir_size_bytes)}</span>
            </div>
          )}
        </div>
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
            <span className={styles.statValue}>{status.database.total_links}</span>
            <span className={styles.statLabel}>Links</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{formatBytes(status.database.estimated_size_bytes)}</span>
            <span className={styles.statLabel}>Est. Size</span>
          </div>
        </div>
        <div className={styles.breakdownRow}>
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
          </div>
          <div className={styles.memoryBreakdown}>
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
      </div>

      {/* Vector DB Stats */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Vector Database</h3>
          {pct === 100 ? (
            <span className={styles.syncBadgeOk}>Synced</span>
          ) : pct > 0 ? (
            <span className={styles.syncBadgeWarn}>{pct}% embedded</span>
          ) : null}
        </div>
        <div className={styles.statusCardBody}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.vector_db.total_vectors.toLocaleString()}</span>
            <span className={styles.statLabel}>Vectors</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{status.vector_db.dimension || '--'}</span>
            <span className={styles.statLabel}>Dimensions</span>
          </div>
        </div>
        {pct < 100 && pct > 0 && (
          <div className={styles.syncProgress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.syncDetail}>
              {status.vector_db.sync_status.vector_count.toLocaleString()} / {status.vector_db.sync_status.expected_count.toLocaleString()} vectors
            </span>
          </div>
        )}
        <div className={styles.collectionInfo}>
          <code className={styles.collectionName}>{status.vector_db.collection_name}</code>
        </div>
        </div>
      </div>

      {/* Timeline */}
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
        </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <h3 className={styles.statusCardTitle}>Recent Jobs</h3>
          {activeJobs > 0 && (
            <span className={styles.jobCountBadge}>
              {status.jobs.running > 0 && <span className={styles.runningDot} />}
              {activeJobs} active
            </span>
          )}
        </div>
        <div className={styles.statusCardBody}>
        {status.recent_jobs.length > 0 ? (
          <div className={styles.jobList}>
            {status.recent_jobs.slice(0, 6).map((job) => (
              <div key={job.id} className={styles.recentJob}>
                <span className={`${styles.jobStatus} ${styles[`job_${job.status}`]}`} />
                <span className={styles.jobType}>{job.job_type.replace(/_/g, ' ')}</span>
                {job.progress != null && job.status === 'running' && (
                  <span className={styles.jobProgress}>{job.progress}%</span>
                )}
                {job.error && (
                  <span className={styles.jobError} title={job.error}>err</span>
                )}
                <span className={styles.jobTime}>
                  {formatTimeAgo(job.completed_at || job.created_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className={styles.emptyJobs}>No recent jobs</span>
        )}
        </div>
      </div>
      </div>
    </div>
  );
}

function ProjectInfo({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const isRemote = project.provider !== 'local';
  const remoteUrl = getRemoteUrl(project);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDesc, setEditDesc] = useState(project.description || '');
  const [editBranch, setEditBranch] = useState(project.remote_branch || '');
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch branches when entering edit mode on a remote project
  useEffect(() => {
    if (editing && isRemote) {
      setLoadingBranches(true);
      api.getProjectBranches(project.id)
        .then((res) => setBranches(res.branches))
        .catch(() => setBranches([]))
        .finally(() => setLoadingBranches(false));
    }
  }, [editing, isRemote, project.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateProject(project.id, {
        name: editName !== project.name ? editName : undefined,
        description: editDesc !== (project.description || '') ? editDesc : undefined,
        remote_branch: isRemote && editBranch !== (project.remote_branch || '') ? editBranch : undefined,
      } as Partial<Project>);
      onUpdate();
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(project.name);
    setEditDesc(project.description || '');
    setEditBranch(project.remote_branch || '');
    setSaveError(null);
    setEditing(false);
  };

  return (
    <div className={styles.infoPanel}>
      {/* Editable fields */}
      <div className={styles.infoSection}>
        <div className={styles.sectionTitleRow}>
          <h3 className={styles.sectionTitle}>Details</h3>
          {!editing ? (
            <button className={styles.editBtn} onClick={() => setEditing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          ) : (
            <div className={styles.editActions}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className={styles.cancelBtn} onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
            </div>
          )}
        </div>
        {saveError && <div className={styles.saveError}>{saveError}</div>}
        {editing ? (
          <div className={styles.editForm}>
            <label className={styles.editLabel}>
              Name
              <input
                className={styles.editInput}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Project name"
              />
            </label>
            <label className={styles.editLabel}>
              Description
              <textarea
                className={styles.editTextarea}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Project description (optional)"
                rows={3}
              />
            </label>
            {isRemote && (
              <label className={styles.editLabel}>
                Branch
                {loadingBranches ? (
                  <span className={styles.emptyValue}>Loading branches...</span>
                ) : branches.length > 0 ? (
                  <select
                    className={styles.editInput}
                    value={editBranch}
                    onChange={e => setEditBranch(e.target.value)}
                  >
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={styles.editInput}
                    value={editBranch}
                    onChange={e => setEditBranch(e.target.value)}
                    placeholder="main"
                  />
                )}
              </label>
            )}
          </div>
        ) : (
          <div className={styles.detailFields}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Name</span>
              <span className={styles.detailValue}>{project.name}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Description</span>
              <span className={styles.detailValue}>{project.description || <span className={styles.emptyValue}>No description</span>}</span>
            </div>
          </div>
        )}
      </div>

      {/* Provider info */}
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
            {remoteUrl ? (
              <a
                href={remoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.remoteLink}
              >
                {project.remote_owner}/{project.remote_repo}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ) : (
              <span className={styles.remoteName}>{project.remote_owner}/{project.remote_repo}</span>
            )}
            {project.remote_branch && (
              <span className={styles.branchBadge}>{project.remote_branch}</span>
            )}
          </div>
          <a href="/settings" className={styles.accountLink}>
            Manage connected accounts
          </a>
        </div>
      )}

      {isRemote && <WebhookInfo project={project} onUpdate={onUpdate} />}
    </div>
  );
}

function WebhookInfo({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<{
    registered: boolean;
    webhook_id?: string;
    webhook_url: string;
    verified?: boolean;
    events?: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await api.getWebhookStatus(project.id);
      setStatus(result);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, [project.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.createWebhook(project.id);
      await checkStatus();
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteWebhook(project.id);
      await checkStatus();
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    } finally {
      setLoading(false);
    }
  };

  const isRegistered = status?.registered ?? project.webhook_registered ?? false;

  return (
    <div className={styles.infoSection}>
      <h3 className={styles.sectionTitle}>Webhook</h3>
      <div className={styles.webhookStatus}>
        <div className={styles.webhookStatusRow}>
          <span
            className={`${styles.webhookDot} ${isRegistered ? styles.webhookDotActive : styles.webhookDotInactive}`}
          />
          <span className={styles.webhookStatusText}>
            {checking ? 'Checking...' : isRegistered ? 'Registered' : 'Not registered'}
          </span>
          {status?.verified && isRegistered && (
            <span className={styles.webhookVerified}>Verified</span>
          )}
        </div>

        {status?.webhook_url && (
          <code className={styles.webhookUrl}>{status.webhook_url}</code>
        )}

        {status?.events && status.events.length > 0 && (
          <div className={styles.webhookEvents}>
            {status.events.map((e) => (
              <span key={e} className={styles.webhookEventBadge}>{e}</span>
            ))}
          </div>
        )}

        {error && <div className={styles.webhookError}>{error}</div>}

        <div className={styles.webhookActions}>
          {isRegistered ? (
            <button
              className={styles.webhookDeleteBtn}
              onClick={handleDelete}
              disabled={loading || checking}
            >
              {loading ? 'Removing...' : 'Remove Webhook'}
            </button>
          ) : (
            <button
              className={styles.webhookRegisterBtn}
              onClick={handleRegister}
              disabled={loading || checking}
            >
              {loading ? 'Registering...' : 'Register Webhook'}
            </button>
          )}
          <button
            className={styles.webhookCheckBtn}
            onClick={checkStatus}
            disabled={loading || checking}
            title="Re-check webhook status"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>
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

  const refreshProject = useCallback(() => {
    mutate(`project-${projectId}`);
  }, [projectId]);

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

  const remoteUrl = getRemoteUrl(project);

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
          <div className={styles.slugRow}>
            <p className={styles.projectSlug}>{project.slug}</p>
            {remoteUrl && (
              <a
                href={remoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.headerRepoLink}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                {project.remote_owner}/{project.remote_repo}
              </a>
            )}
          </div>
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
        {tab === 'info' && <ProjectInfo project={project} onUpdate={refreshProject} />}
        {tab === 'members' && (
          <ProjectMemberManager projectId={projectId!} />
        )}
        {tab === 'weights' && <ProjectSettings projectId={projectId!} />}
        {tab === 'advanced' && <AdvancedSettings projectId={projectId!} />}
      </div>
    </motion.div>
  );
}
