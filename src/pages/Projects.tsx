import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api, API_BASE } from '../lib/api';
import { useProject } from '../stores/project';
import type { Project, CreateProjectRequest, ConnectedAccount } from '../lib/api';
import { Modal, EmptyState } from '../components/ui';
import styles from './Projects.module.css';

export function Projects() {
  const navigate = useNavigate();
  const { selectProject } = useProject();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('local');
  const [authMethod, setAuthMethod] = useState<'account' | 'token'>('account');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [connections, setConnections] = useState<ConnectedAccount[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [pollingForConnection, setPollingForConnection] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionsCountRef = useRef(0);

  /** Build the connect URL with the auth token as a query param. */
  const connectUrl = (prov: string) => {
    const token = api.getToken();
    const base = `${API_BASE}/auth/connect/${prov}`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  };

  const { data: projects, isLoading } = useSWR<Project[]>('projects', api.listProjects, {
    refreshInterval: 10000,
  });

  /** Fetch connections for the current provider and update state. */
  const fetchConnections = useCallback(() => {
    return api.getConnections()
      .then((res) => {
        const filtered = res.connections.filter((c) => c.provider === provider);
        setConnections(filtered);
        if (filtered.length > 0 && !selectedAccountId) {
          setSelectedAccountId(filtered[0].id);
        }
        return filtered;
      })
      .catch(() => {
        setConnections([]);
        return [] as ConnectedAccount[];
      });
  }, [provider, selectedAccountId]);

  // Fetch connected accounts when the modal opens with a remote provider
  useEffect(() => {
    if (isCreateOpen && provider !== 'local') {
      setLoadingConnections(true);
      fetchConnections().finally(() => setLoadingConnections(false));
    }
  }, [isCreateOpen, provider]);

  /** Called when user clicks a connect link -- starts polling for new accounts. */
  const handleConnectClick = () => {
    connectionsCountRef.current = connections.length;
    setPollingForConnection(true);
  };

  // Poll for new connections after the user clicks "Connect"
  useEffect(() => {
    if (!pollingForConnection) return;

    pollingRef.current = setInterval(() => {
      api.getConnections()
        .then((res) => {
          const filtered = res.connections.filter((c) => c.provider === provider);
          if (filtered.length > connectionsCountRef.current) {
            // New account appeared -- stop polling and update
            setConnections(filtered);
            setSelectedAccountId(filtered[filtered.length - 1].id);
            setPollingForConnection(false);
          }
        })
        .catch(() => {});
    }, 1000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollingForConnection, provider]);

  // Stop polling when modal closes
  useEffect(() => {
    if (!isCreateOpen) {
      setPollingForConnection(false);
    }
  }, [isCreateOpen]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const providerValue = formData.get('provider') as string;

    const data: CreateProjectRequest = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      description: formData.get('description') as string || undefined,
      provider: providerValue,
      root_path: formData.get('root_path') as string,
    };

    // Add remote fields for github/gitlab providers
    if (providerValue !== 'local') {
      data.remote_owner = formData.get('remote_owner') as string || undefined;
      data.remote_repo = formData.get('remote_repo') as string || undefined;
      data.remote_branch = formData.get('remote_branch') as string || undefined;

      if (authMethod === 'account' && selectedAccountId) {
        data.connected_account_id = selectedAccountId;
      } else if (authMethod === 'token') {
        data.access_token = formData.get('access_token') as string || undefined;
      }
    }

    try {
      await api.createProject(data);
      mutate('projects');
      setIsCreateOpen(false);
      setProvider('local');
      setSelectedAccountId('');
      setAuthMethod('account');
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
              onClick={() => {
                selectProject(project.id);
                navigate(`/projects/${project.id}`);
              }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project);
                    }}
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
                  {project.provider === 'github' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  ) : project.provider === 'gitlab' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  )}
                  <span className={styles.metaValue}>
                    {project.provider === 'local' ? 'Local' : `${project.remote_owner}/${project.remote_repo}`}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className={styles.metaValue}>{formatDate(project.created_at)}</span>
                </div>
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
              Slug *
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              className={styles.input}
              placeholder="my-project"
              required
              pattern="[a-z0-9-]+"
              title="Lowercase letters, numbers, and hyphens only"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="provider">
              Provider *
            </label>
            <select
              id="provider"
              name="provider"
              className={styles.input}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              required
            >
              <option value="local">Local (filesystem)</option>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="root_path">
              Root Path *
            </label>
            <input
              type="text"
              id="root_path"
              name="root_path"
              className={styles.input}
              placeholder="/path/to/project"
              required
            />
            <small className={styles.hint}>Local path where the project (and fold/ directory) lives</small>
          </div>

          {provider !== 'local' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="remote_owner">
                  Owner *
                </label>
                <input
                  type="text"
                  id="remote_owner"
                  name="remote_owner"
                  className={styles.input}
                  placeholder="username or organisation"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="remote_repo">
                  Repository *
                </label>
                <input
                  type="text"
                  id="remote_repo"
                  name="remote_repo"
                  className={styles.input}
                  placeholder="repository-name"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="remote_branch">
                  Branch
                </label>
                <input
                  type="text"
                  id="remote_branch"
                  name="remote_branch"
                  className={styles.input}
                  placeholder="main"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Authentication
                </label>
                <div className={styles.authToggle}>
                  <button
                    type="button"
                    className={`${styles.authToggleBtn} ${authMethod === 'account' ? styles.authToggleActive : ''}`}
                    onClick={() => setAuthMethod('account')}
                  >
                    Connected Account
                  </button>
                  <button
                    type="button"
                    className={`${styles.authToggleBtn} ${authMethod === 'token' ? styles.authToggleActive : ''}`}
                    onClick={() => setAuthMethod('token')}
                  >
                    Manual Token
                  </button>
                </div>
              </div>

              {authMethod === 'account' ? (
                <div className={styles.formGroup}>
                  {loadingConnections ? (
                    <div className={styles.hint}>Loading accounts...</div>
                  ) : connections.length > 0 ? (
                    <>
                      <select
                        className={styles.input}
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                      >
                        {connections.map((conn) => (
                          <option key={conn.id} value={conn.id}>
                            {conn.username} ({conn.provider})
                          </option>
                        ))}
                      </select>
                      <a
                        href={connectUrl(provider)}
                        target="_blank"
                        rel="noopener"
                        className={styles.connectLink}
                        onClick={handleConnectClick}
                      >
                        + Connect another {provider === 'github' ? 'GitHub' : 'GitLab'} account
                      </a>
                    </>
                  ) : (
                    <div className={styles.connectPrompt}>
                      <p className={styles.hint}>No {provider === 'github' ? 'GitHub' : 'GitLab'} accounts connected.</p>
                      <a
                        href={connectUrl(provider)}
                        target="_blank"
                        rel="noopener"
                        className={styles.connectBtn}
                        onClick={handleConnectClick}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                        </svg>
                        Connect {provider === 'github' ? 'GitHub' : 'GitLab'}
                      </a>
                      {pollingForConnection && (
                        <p className={styles.hint}>Waiting for authorisation...</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="access_token">
                    Access Token
                  </label>
                  <input
                    type="password"
                    id="access_token"
                    name="access_token"
                    className={styles.input}
                    placeholder="ghp_xxxxx or glpat-xxxxx"
                  />
                  <small className={styles.hint}>Personal access token for private repositories</small>
                </div>
              )}
            </>
          )}

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
        </form>
      </Modal>

    </motion.div>
  );
}
