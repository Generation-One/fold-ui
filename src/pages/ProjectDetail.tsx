import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { api } from '../lib/api';
import type { Project } from '../lib/api';
import { RepositoryManager } from '../components/RepositoryManager';
import { ProjectSettings } from '../components/ProjectSettings';
import styles from './ProjectDetail.module.css';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'repositories' | 'settings'>('repositories');

  const { data: project, isLoading, error } = useSWR<Project>(
    projectId ? `project-${projectId}` : null,
    () => (projectId ? api.getProject(projectId) : Promise.reject())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => navigate('/projects')} className={styles.backBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </button>
      </div>

      {/* Project Info Card */}
      <div className={styles.infoCard}>
        <div className={styles.infoHeader}>
          <div>
            <h1 className={styles.projectName}>{project.name}</h1>
            <p className={styles.projectSlug}>{project.slug}</p>
          </div>
        </div>

        {project.description && (
          <p className={styles.description}>{project.description}</p>
        )}

        {/* Project Metadata */}
        <div className={styles.metadata}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Created</span>
            <span className={styles.metaValue}>{formatDate(project.created_at)}</span>
          </div>
          {project.repo_url && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Repository</span>
              <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                {project.repo_url}
              </a>
            </div>
          )}
          {project.metadata_repo_enabled && (
            <>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Metadata Sync</span>
                <span className={styles.metaBadge}>Enabled</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Storage Mode</span>
                <span className={styles.metaValue}>
                  {project.metadata_repo_mode === 'in_repo' ? 'In Repository' : 'Separate Repository'}
                </span>
              </div>
              {project.metadata_repo_mode === 'separate' && (
                <>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Metadata Provider</span>
                    <span className={styles.metaValue}>{project.metadata_repo_provider}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Metadata Repository</span>
                    <span className={styles.metaValue}>
                      {project.metadata_repo_owner}/{project.metadata_repo_name}
                    </span>
                  </div>
                </>
              )}
              {project.metadata_repo_branch && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Metadata Branch</span>
                  <span className={styles.metaValue}>{project.metadata_repo_branch}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'repositories' ? styles.active : ''}`}
          onClick={() => setTab('repositories')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
          </svg>
          Repositories
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
        {tab === 'repositories' ? (
          <RepositoryManager projectId={projectId!} />
        ) : (
          <ProjectSettings projectId={projectId!} />
        )}
      </div>
    </motion.div>
  );
}
