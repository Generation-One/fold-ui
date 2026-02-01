import { useState } from 'react';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import type { Repository, RepositoryCreateByUrl } from '../lib/api';
import { Modal, EmptyState } from './ui';
import styles from './RepositoryManager.module.css';

interface RepositoryManagerProps {
  projectId: string;
}

export function RepositoryManager({ projectId }: RepositoryManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReindexing, setIsReindexing] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: repositories, isLoading, error: fetchError } = useSWR<Repository[]>(
    projectId ? `repositories-${projectId}` : null,
    () => api.listRepositories(projectId),
    {
      refreshInterval: 5000,
      onError: (err) => console.error('Failed to fetch repositories:', err),
    }
  );

  // Ensure repositories is always an array
  const repoList = Array.isArray(repositories) ? repositories : [];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const data: RepositoryCreateByUrl = {
      url: formData.get('url') as string,
      access_token: formData.get('access_token') as string,
      auto_index: formData.get('auto_index') === 'on',
    };

    try {
      await api.createRepository(projectId, data);
      mutate(`repositories-${projectId}`);
      setIsCreateOpen(false);
      setSuccess('Repository connected successfully!');
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect repository');
    } finally {
      setIsCreating(false);
    }
  };

  const handleReindex = async (repo: Repository) => {
    if (!confirm(`Reindex repository ${repo.owner}/${repo.name}?`)) return;

    setIsReindexing(repo.id);
    setError(null);

    try {
      await api.reindexRepository(projectId, repo.id);
      setSuccess('Reindex job started');
      mutate(`repositories-${projectId}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reindex repository');
    } finally {
      setIsReindexing(null);
    }
  };

  const handleDelete = async (repo: Repository) => {
    if (!confirm(`Delete repository connection for ${repo.owner}/${repo.name}? This will not delete the repository itself.`)) return;

    try {
      await api.deleteRepository(projectId, repo.id);
      mutate(`repositories-${projectId}`);
      setSuccess('Repository disconnected');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  const handleSync = async (repo: Repository) => {
    setIsSyncing(repo.id);
    setError(null);

    try {
      await api.syncRepository(projectId, repo.id);
      setSuccess('Sync started');
      mutate(`repositories-${projectId}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync repository');
    } finally {
      setIsSyncing(null);
    }
  };

  const handleTogglePolling = async (repo: Repository) => {
    try {
      await api.updateRepository(projectId, repo.id, {
        polling_enabled: !repo.polling_enabled,
      });
      mutate(`repositories-${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update polling setting');
    }
  };

  const getStatusColor = (status: Repository['status']) => {
    switch (status) {
      case 'connected':
        return styles.statusConnected;
      case 'syncing':
        return styles.statusSyncing;
      case 'error':
        return styles.statusError;
      case 'disconnected':
        return styles.statusDisconnected;
      default:
        return styles.statusDisconnected;
    }
  };

  const getProviderIcon = (provider: 'git-hub' | 'git-lab') => {
    return provider === 'git-hub' ? (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.372 0 12c0 5.305 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    );
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Connected Repositories</h2>
          <p className={styles.subtitle}>Manage your connected git repositories</p>
        </div>
        <button className={styles.connectBtn} onClick={() => setIsCreateOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Connect Repository
        </button>
      </div>

      {/* Messages */}
      {success && <div className={styles.success}>{success}</div>}
      {error && <div className={styles.error}>{error}</div>}
      {fetchError && <div className={styles.error}>Failed to load repositories. The endpoint may not be implemented yet.</div>}

      {/* Content */}
      {isLoading ? (
        <div className={styles.loading}>Loading repositories...</div>
      ) : repoList.length === 0 ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
            </svg>
          }
          title="No repositories connected"
          description="Connect your first repository to enable automatic indexing"
          action={{
            label: 'Connect Repository',
            onClick: () => setIsCreateOpen(true),
          }}
        />
      ) : (
        <div className={styles.repoList}>
          {repoList.map((repo) => (
            <motion.div
              key={repo.id}
              className={styles.repoCard}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className={styles.repoHeader}>
                <div className={styles.repoInfo}>
                  <div className={styles.providerIcon}>{getProviderIcon(repo.provider)}</div>
                  <div>
                    <h3 className={styles.repoName}>
                      {repo.owner}/{repo.name}
                    </h3>
                    <p className={styles.repoBranch}>{repo.default_branch}</p>
                  </div>
                </div>
                <div className={styles.repoActions}>
                  <button
                    className={`${styles.actionBtn} ${styles.secondary}`}
                    onClick={() => handleSync(repo)}
                    disabled={isSyncing === repo.id}
                    title="Sync repository"
                  >
                    {isSyncing === repo.id ? (
                      <>
                        <svg
                          className={styles.spinner}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        Syncing
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
                        </svg>
                        Sync
                      </>
                    )}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.secondary}`}
                    onClick={() => handleReindex(repo)}
                    disabled={isReindexing === repo.id}
                    title="Reindex repository"
                  >
                    {isReindexing === repo.id ? (
                      <>
                        <svg
                          className={styles.spinner}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        Reindexing
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2-8.83" />
                        </svg>
                        Reindex
                      </>
                    )}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.danger}`}
                    onClick={() => handleDelete(repo)}
                    title="Disconnect repository"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className={styles.repoMeta}>
                <div className={styles.metaItem}>
                  <span className={`${styles.statusBadge} ${getStatusColor(repo.status)}`}>
                    {repo.status}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  {repo.auto_index ? (
                    <span className={styles.autoIndexBadge}>Auto-index enabled</span>
                  ) : (
                    <span className={styles.autoIndexBadgeDisabled}>Auto-index disabled</span>
                  )}
                </div>
                <button
                  className={styles.pollingToggle}
                  onClick={() => handleTogglePolling(repo)}
                  title={repo.polling_enabled ? 'Disable polling' : 'Enable polling'}
                >
                  <span className={repo.polling_enabled ? styles.pollingEnabled : styles.pollingDisabled}>
                    {repo.polling_enabled ? 'Polling on' : 'Polling off'}
                  </span>
                </button>
                {repo.last_indexed_at && (
                  <div className={styles.metaItem}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Indexed: {new Date(repo.last_indexed_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {repo.error_message && (
                <div className={styles.errorMessage}>{repo.error_message}</div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Connect Repository"
        footer={
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="create-repo-form"
              className={styles.submitBtn}
              disabled={isCreating}
            >
              {isCreating ? 'Connecting...' : 'Connect Repository'}
            </button>
          </div>
        }
      >
        <form id="create-repo-form" className={styles.form} onSubmit={handleCreate}>
          {error && <div className={styles.formError}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="url">
              Repository URL *
            </label>
            <input
              type="url"
              id="url"
              name="url"
              className={styles.input}
              placeholder="https://github.com/owner/repo"
              required
            />
            <p className={styles.helperText}>
              Paste the full URL to your GitHub or GitLab repository
            </p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="access_token">
              Access Token *
            </label>
            <input
              type="password"
              id="access_token"
              name="access_token"
              className={styles.input}
              placeholder="ghp_... or glpat-..."
              required
            />
            <p className={styles.helperText}>
              {`Create a token with repo scope at `}
              <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
                GitHub Settings
              </a>
              {` or `}
              <a href="https://gitlab.com/-/user_settings/personal_access_tokens" target="_blank" rel="noopener noreferrer">
                GitLab Settings
              </a>
            </p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="auto_index"
                defaultChecked
              />
              Automatically index on push
            </label>
            <p className={styles.helperText}>
              When enabled, new commits will be automatically indexed via webhooks
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
