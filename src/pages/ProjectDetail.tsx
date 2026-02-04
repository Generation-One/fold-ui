import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { api } from '../lib/api';
import type { Project } from '../lib/api';
import { RepositoryManager } from '../components/RepositoryManager';
import { ProjectSettings } from '../components/ProjectSettings';
import { ProjectMemberManager } from '../components/ProjectMemberManager';
import styles from './ProjectDetail.module.css';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'repositories' | 'settings' | 'members'>('repositories');

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
          className={`${styles.tab} ${tab === 'repositories' ? styles.active : ''}`}
          onClick={() => setTab('repositories')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
          </svg>
          Repositories
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
        {tab === 'repositories' && <RepositoryManager projectId={projectId!} />}
        {tab === 'members' && (
          <ProjectMemberManager
            projectId={projectId!}
            projectName={project.name}
            isModal={false}
          />
        )}
        {tab === 'settings' && <ProjectSettings projectId={projectId!} />}
      </div>
    </motion.div>
  );
}
