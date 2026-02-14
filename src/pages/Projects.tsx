import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api, API_BASE } from '../lib/api';
import { useProject } from '../stores/project';
import type { Project, CreateProjectRequest, ConnectedAccount, GitHubRepo, GitHubBranch, AuthProvider } from '../lib/api';
import { Modal, EmptyState } from '../components/ui';
import styles from './Projects.module.css';

export function Projects() {
  const navigate = useNavigate();
  const { selectProject } = useProject();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Provider
  const [provider, setProvider] = useState<string>('local');

  // Step 2: Auth
  const [authMethod, setAuthMethod] = useState<'account' | 'token'>('account');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [connections, setConnections] = useState<ConnectedAccount[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [pollingForConnection, setPollingForConnection] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionsCountRef = useRef(0);
  const connectionsSnapshotRef = useRef('');
  const [manualToken, setManualToken] = useState('');
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);
  const [repoFetchKey, setRepoFetchKey] = useState(0);

  // Step 3: Repository
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  // Step 4: Branch
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Step 5: Project details
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  /** Build the connect URL with the auth token as a query param. */
  const connectUrl = (prov: string) => {
    const token = api.getToken();
    const base = `${API_BASE}/auth/connect/${prov}`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  };

  // Pagination state
  const PAGE_SIZE = 50;
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Groups for autocomplete
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [projectGroup, setProjectGroup] = useState('');

  const { data: projectsData, isLoading } = useSWR('projects', () => api.listProjects({ limit: PAGE_SIZE, offset: 0 }), {
    refreshInterval: 10000,
    onSuccess: (data) => {
      setAllProjects(data.projects);
      setTotal(data.total);
    },
  });

  // Fetch group names for autocomplete
  useEffect(() => {
    api.getProjectGroups().then((res) => setGroupNames(res.groups)).catch(() => {});
  }, [allProjects]);

  // Load more projects
  const loadMore = useCallback(async () => {
    if (loadingMore || allProjects.length >= total) return;
    setLoadingMore(true);
    try {
      const result = await api.listProjects({ limit: PAGE_SIZE, offset: allProjects.length });
      setAllProjects((prev) => [...prev, ...result.projects]);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [allProjects.length, total, loadingMore]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const projects = allProjects;

  // Group projects
  const groupedProjects = useMemo(() => {
    if (!projects?.length) return [];
    const groups = new Map<string, Project[]>();
    const ungrouped: Project[] = [];
    for (const p of projects) {
      if (p.project_group) {
        if (!groups.has(p.project_group)) groups.set(p.project_group, []);
        groups.get(p.project_group)!.push(p);
      } else {
        ungrouped.push(p);
      }
    }
    const result: { group: string | null; projects: Project[] }[] = [];
    // Sorted groups first
    for (const [name, projs] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      result.push({ group: name, projects: projs });
    }
    // Ungrouped at the bottom
    if (ungrouped.length > 0) {
      result.push({ group: null, projects: ungrouped });
    }
    return result;
  }, [projects]);

  // Determine if auth is resolved (user has selected an account or entered a manual token)
  const authResolved = provider === 'local' || (
    authMethod === 'account' ? !!selectedAccountId : !!manualToken
  );

  // Determine if repo is selected (for remote providers)
  // For account auth: requires selectedRepo from the picker
  // For manual token: always resolved (owner/repo are required form fields)
  const repoResolved = provider === 'local' || authMethod === 'token' || !!selectedRepo;

  /** Fetch connections for the current provider. */
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

  // Fetch connected accounts and auth providers when modal opens with a remote provider
  useEffect(() => {
    if (isCreateOpen && provider !== 'local') {
      setLoadingConnections(true);
      fetchConnections().finally(() => setLoadingConnections(false));
      api.getAuthProviders()
        .then((res) => setAuthProviders(res.providers))
        .catch(() => {});
    }
  }, [isCreateOpen, provider]);

  /** Called when user clicks a connect link -- starts polling. */
  const handleConnectClick = () => {
    connectionsCountRef.current = connections.length;
    // Snapshot updated_at values so we can detect token refreshes (same account reconnected)
    connectionsSnapshotRef.current = connections.map((c) => c.updated_at).sort().join(',');
    setPollingForConnection(true);
  };

  // Poll for new connections after connect click
  useEffect(() => {
    if (!pollingForConnection) return;

    pollingRef.current = setInterval(() => {
      api.getConnections()
        .then((res) => {
          const filtered = res.connections.filter((c) => c.provider === provider);
          const newSnapshot = filtered.map((c) => c.updated_at).sort().join(',');
          const changed = filtered.length > connectionsCountRef.current
            || newSnapshot !== connectionsSnapshotRef.current;
          if (changed) {
            setConnections(filtered);
            setSelectedAccountId(filtered[filtered.length - 1].id);
            setRepoFetchKey((k) => k + 1);
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

  // Fetch repos when auth is resolved (connected account selected)
  useEffect(() => {
    if (provider === 'local') return;
    if (authMethod !== 'account' || !selectedAccountId) {
      setRepos([]);
      return;
    }

    setLoadingRepos(true);
    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranch('');
    api.getConnectionRepos(selectedAccountId, { per_page: 100 })
      .then((res) => setRepos(res.repos))
      .catch(() => setRepos([]))
      .finally(() => setLoadingRepos(false));
  }, [selectedAccountId, authMethod, provider, repoFetchKey]);

  // Filter repos by search
  const filteredRepos = useMemo(() => {
    if (!repoSearch) return repos;
    const q = repoSearch.toLowerCase();
    return repos.filter(
      (r) => r.full_name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repos, repoSearch]);

  // Fetch branches when a repo is selected
  useEffect(() => {
    if (!selectedRepo || !selectedAccountId) {
      setBranches([]);
      setSelectedBranch('');
      return;
    }

    const [owner, repo] = selectedRepo.full_name.split('/');
    setLoadingBranches(true);
    api.getConnectionRepoBranches(selectedAccountId, owner, repo)
      .then((res) => {
        setBranches(res.branches);
        // Auto-select default branch
        setSelectedBranch(selectedRepo.default_branch);
      })
      .catch(() => setBranches([]))
      .finally(() => setLoadingBranches(false));
  }, [selectedRepo, selectedAccountId]);

  // Auto-fill project name/slug when repo is selected
  useEffect(() => {
    if (selectedRepo) {
      setProjectName(selectedRepo.name);
      setProjectSlug(selectedRepo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
    }
  }, [selectedRepo]);

  const resetForm = () => {
    setProvider('local');
    setAuthMethod('account');
    setSelectedAccountId('');
    setManualToken('');
    setConnections([]);
    setRepos([]);
    setRepoSearch('');
    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranch('');
    setProjectName('');
    setProjectSlug('');
    setProjectDescription('');
    setProjectGroup('');
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const data: CreateProjectRequest = {
      name: projectName,
      slug: projectSlug,
      description: projectDescription || undefined,
      provider,
      project_group: projectGroup || undefined,
    };

    const formData = new FormData(e.currentTarget);

    if (provider === 'local') {
      data.root_path = formData.get('root_path') as string;
    } else {
      // Remote provider
      if (authMethod === 'account' && selectedRepo) {
        const [owner, repo] = selectedRepo.full_name.split('/');
        data.remote_owner = owner;
        data.remote_repo = repo;
        data.remote_branch = selectedBranch || undefined;
        data.connected_account_id = selectedAccountId;
      } else if (authMethod === 'token') {
        data.remote_owner = formData.get('remote_owner') as string || undefined;
        data.remote_repo = formData.get('remote_repo') as string || undefined;
        data.remote_branch = formData.get('remote_branch') as string || undefined;
        data.access_token = manualToken || undefined;
      }
    }

    try {
      await api.createProject(data);
      // Reset and refetch
      setAllProjects([]);
      mutate('projects');
      setIsCreateOpen(false);
      resetForm();
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

  const providerLabel = provider === 'github' ? 'GitHub' : provider === 'gitlab' ? 'GitLab' : 'Local';
  const githubProvider = authProviders.find((p) => p.id === 'github');
  const appSlug = githubProvider?.app_slug;
  const providerClientId = githubProvider?.client_id;
  // GitHub App: link to manage installations; legacy OAuth App: link to manage org access
  const manageAccessUrl = provider === 'github'
    ? appSlug
      ? `https://github.com/apps/${appSlug}/installations/new`
      : providerClientId
        ? `https://github.com/settings/connections/applications/${providerClientId}`
        : null
    : null;
  const manageAccessLabel = appSlug
    ? 'Manage repository access on GitHub'
    : 'Manage organisation access on GitHub';
  const manageAccessHint = appSlug
    ? 'After updating access, reconnect to refresh permissions'
    : 'After granting access, reconnect to refresh permissions';

  // Can the form be submitted?
  const canSubmit = !!projectName && !!projectSlug && (
    provider === 'local' || (authResolved && repoResolved)
  );

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
        <div>
          {groupedProjects.map(({ group, projects: groupProjects }) => (
            <div key={group ?? '__ungrouped'} className={styles.groupSection}>
              {group && <h2 className={styles.groupHeader}>{group}</h2>}
              {!group && groupedProjects.length > 1 && <h2 className={styles.groupHeader}>Ungrouped</h2>}
              <div className={styles.projectGrid}>
                {groupProjects.map((project) => (
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
                        {project.project_group && (
                          <span className={styles.groupBadge}>{project.project_group}</span>
                        )}
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
            </div>
          ))}
          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className={styles.loadMore}>
            {loadingMore && <span className={styles.loading}>Loading more...</span>}
            {!loadingMore && allProjects.length < total && (
              <button className={styles.loadMoreBtn} onClick={loadMore}>
                Load more ({allProjects.length} of {total})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); resetForm(); }}
        title="Create Project"
        footer={
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancel
            </button>
            <button
              type="submit"
              form="create-project-form"
              className={styles.submitBtn}
              disabled={creating || !canSubmit}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        }
      >
        <form id="create-project-form" className={styles.form} onSubmit={handleCreate}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Step 1: Provider */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="provider">
              Provider
            </label>
            <select
              id="provider"
              name="provider"
              className={styles.input}
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setSelectedRepo(null);
                setBranches([]);
                setSelectedBranch('');
                setSelectedAccountId('');
                setRepoSearch('');
              }}
              required
            >
              <option value="local">Local (filesystem)</option>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </select>
          </div>

          {/* Step 2: Auth (remote only) */}
          {provider !== 'local' && (
            <>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <a
                          href={connectUrl(provider)}
                          target="_blank"
                          rel="noopener"
                          className={styles.connectLink}
                          onClick={handleConnectClick}
                        >
                          + Connect another {providerLabel} account
                        </a>
                        {manageAccessUrl && (
                          <>
                            <a
                              href={manageAccessUrl}
                              target="_blank"
                              rel="noopener"
                              className={styles.connectLink}
                            >
                              {manageAccessLabel}
                            </a>
                            <span className={styles.hint}>{manageAccessHint}</span>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={styles.connectPrompt}>
                      <p className={styles.hint}>No {providerLabel} accounts connected.</p>
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
                        Connect {providerLabel}
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
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                  <small className={styles.hint}>Personal access token for private repositories</small>
                </div>
              )}
            </>
          )}

          {/* Step 3: Repository picker (remote + account auth only) */}
          {provider !== 'local' && authMethod === 'account' && selectedAccountId && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Repository</label>
              {loadingRepos ? (
                <div className={styles.hint}>Loading repositories...</div>
              ) : repos.length > 0 ? (
                <>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Search repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                  />
                  <div className={styles.repoList}>
                    {filteredRepos.slice(0, 50).map((repo) => (
                      <button
                        key={repo.id}
                        type="button"
                        className={`${styles.repoItem} ${selectedRepo?.id === repo.id ? styles.repoItemSelected : ''}`}
                        onClick={() => setSelectedRepo(repo)}
                      >
                        <div className={styles.repoItemMain}>
                          <span className={styles.repoName}>{repo.full_name}</span>
                          {repo.private && <span className={styles.repoBadge}>private</span>}
                        </div>
                        {repo.description && (
                          <span className={styles.repoDescription}>{repo.description}</span>
                        )}
                      </button>
                    ))}
                    {filteredRepos.length === 0 && (
                      <div className={styles.hint} style={{ padding: '0.75rem' }}>No matching repositories</div>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.hint}>No repositories found for this account</div>
              )}
            </div>
          )}

          {/* For manual token: show owner/repo fields */}
          {provider !== 'local' && authMethod === 'token' && (
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
            </>
          )}

          {/* Step 4: Branch picker (remote + account + repo selected) */}
          {provider !== 'local' && authMethod === 'account' && selectedRepo && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Branch</label>
              {loadingBranches ? (
                <div className={styles.hint}>Loading branches...</div>
              ) : branches.length > 0 ? (
                <select
                  className={styles.input}
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}{b.name === selectedRepo.default_branch ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={styles.hint}>No branches found</div>
              )}
            </div>
          )}

          {/* Divider before project details */}
          {(provider === 'local' || repoResolved) && (
            <div className={styles.divider} />
          )}

          {/* Step 5: Project details (always visible for local, after repo selection for remote) */}
          {provider === 'local' && (
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
          )}

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
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
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
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value)}
              required
              pattern="[a-z0-9-]+"
              title="Lowercase letters, numbers, and hyphens only"
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
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="project_group">
              Group
            </label>
            <input
              type="text"
              id="project_group"
              name="project_group"
              className={styles.input}
              placeholder="e.g. Frontend, Backend, Infrastructure"
              value={projectGroup}
              onChange={(e) => setProjectGroup(e.target.value)}
              list="project-group-options"
            />
            <datalist id="project-group-options">
              {groupNames.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <small className={styles.hint}>Optional — group related projects together</small>
          </div>
        </form>
      </Modal>

    </motion.div>
  );
}
