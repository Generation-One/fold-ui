import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import type { Project } from '../lib/api';
import { Modal, EmptyState } from '../components/ui';
import styles from './Projects.module.css';

export function Projects() {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: projects, isLoading } = useSWR<Project[]>('projects', api.listProjects, {
    refreshInterval: 10000,
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string || undefined,
      description: formData.get('description') as string || undefined,
      repo_url: formData.get('repo_url') as string || undefined,
    };

    try {
      await api.createProject(data);
      mutate('projects');
      setIsCreateOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;

    try {
      await api.deleteProject(project.id);
      mutate('projects');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
          <h1 className={styles.pageTitle}>Projects</h1>
          <p className={styles.pageSubtitle}>Manage your memory projects</p>
        </div>
        <button className={styles.createBtn} onClick={() => setIsCreateOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Project
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className={styles.loading}>Loading projects...</div>
      ) : projects?.length === 0 ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
          title="No projects yet"
          description="Create your first project to start organizing memories"
          action={{
            label: 'Create Project',
            onClick: () => setIsCreateOpen(true),
          }}
        />
      ) : (
        <div className={styles.projectGrid}>
          {projects?.map((project) => (
            <motion.div
              key={project.id}
              className={styles.projectCard}
              onClick={() => navigate(`/projects/${project.id}`)}
              style={{ cursor: 'pointer' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className={styles.projectHeader}>
                <div>
                  <h3 className={styles.projectName}>{project.name}</h3>
                  <span className={styles.projectSlug}>{project.slug}</span>
                </div>
                <div className={styles.projectActions}>
                  <button
                    className={`${styles.actionBtn} ${styles.danger}`}
                    onClick={() => handleDelete(project)}
                    title="Delete project"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              {project.description && (
                <p className={styles.projectDescription}>{project.description}</p>
              )}

              <div className={styles.projectMeta}>
                <div className={styles.metaItem}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className={styles.metaValue}>{formatDate(project.created_at)}</span>
                </div>
                {project.repo_url && (
                  <div className={styles.metaItem}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
                    </svg>
                    <span className={styles.metaValue}>Linked</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Project"
        footer={
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="create-project-form"
              className={styles.submitBtn}
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        }
      >
        <form id="create-project-form" className={styles.form} onSubmit={handleCreate}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="name">
              Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className={styles.input}
              placeholder="My Project"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="slug">
              Slug
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              className={styles.input}
              placeholder="my-project (auto-generated if empty)"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className={styles.textarea}
              placeholder="What's this project about?"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="repo_url">
              Repository URL
            </label>
            <input
              type="url"
              id="repo_url"
              name="repo_url"
              className={styles.input}
              placeholder="https://github.com/user/repo"
            />
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
