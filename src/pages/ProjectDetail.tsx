import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { api } from '../lib/api';
import type { Project } from '../lib/api';
import { ProjectSettings } from '../components/ProjectSettings';
import { ProjectMemberManager } from '../components/ProjectMemberManager';
import styles from './ProjectDetail.module.css';

function ProjectInfo({ project }: { project: Project }) {
  const [syncing, setSyncing] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncProject(project.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleReindex = async () => {
    if (!confirm('Reindex will re-process all files. Continue?')) return;
    setReindexing(true);
    try {
      await api.reindexProject(project.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reindex');
    } finally {
      setReindexing(false);
    }
  };

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

      <div className={styles.infoSection}>
        <h3 className={styles.sectionTitle}>Actions</h3>
        <div className={styles.actions}>
          {isRemote && (
            <button
              className={styles.actionBtn}
              onClick={handleSync}
              disabled={syncing}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              {syncing ? 'Syncing...' : 'Sync from Remote'}
            </button>
          )}
          <button
            className={styles.actionBtn}
            onClick={handleReindex}
            disabled={reindexing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
            {reindexing ? (isRemote ? 'Reindexing...' : 'Scanning...') : (isRemote ? 'Reindex' : 'Scan & Index')}
          </button>
        </div>
      </div>

      {project.memory_count !== undefined && (
        <div className={styles.infoSection}>
          <h3 className={styles.sectionTitle}>Memories</h3>
          <span className={styles.memoryCount}>{project.memory_count} memories stored</span>
        </div>
      )}
    </div>
  );
}

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'info' | 'settings' | 'members'>('info');

  const { data: project, isLoading, error } = useSWR<Project>(
    projectId ? `project-${projectId}` : null,
    () => (projectId ? api.getProject(projectId) : Promise.reject())
  );

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
      </div>

      {project.description && (
        <p className={styles.description}>{project.description}</p>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
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
          className={`${styles.tab} ${tab === 'settings' ? styles.active : ''}`}
          onClick={() => setTab('settings')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6m8.66-13.66l-4.24 4.24M7.58 16.42l-4.24 4.24M23 12h-6m-6 0H1m20.66 8.66l-4.24-4.24M7.58 7.58L3.34 3.34" />
          </svg>
          Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {tab === 'info' && <ProjectInfo project={project} />}
        {tab === 'members' && (
          <ProjectMemberManager projectId={projectId!} />
        )}
        {tab === 'settings' && <ProjectSettings projectId={projectId!} />}
      </div>
    </motion.div>
  );
}
