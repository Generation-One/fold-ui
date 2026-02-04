import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api, API_BASE } from '../lib/api';
import type { LLMProvider, LLMProviderCreateRequest, EmbeddingProvider, EmbeddingProviderCreateRequest, ClaudeCodeStatus } from '../lib/api';
import { useAuth } from '../stores/auth';
import { Modal } from '../components/ui';
import { useToast } from '../components/ToastContext';
import styles from './Settings.module.css';

export function Settings() {
  const { token, isAuthenticated, setToken, clearAuth, bootstrap, error } = useAuth();
  const { showToast } = useToast();
  const [mainTab, setMainTab] = useState<'token' | 'oauth' | 'bootstrap' | 'llm' | 'embedding'>('token');

  // Token form
  const [tokenInput, setTokenInput] = useState(token || '');
  const [tokenSaved, setTokenSaved] = useState(false);

  // Bootstrap form
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<string | null>(null);


  const { data: providers } = useSWR('auth-providers', () => api.getAuthProviders());

  // Provider management
  const [isCreateProviderOpen, setIsCreateProviderOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | EmbeddingProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [selectedProviderName, setSelectedProviderName] = useState<string>('gemini');
  const [selectedAuthType, setSelectedAuthType] = useState<'api_key' | 'oauth'>('api_key');

  // Claude Code specific state
  const [claudeCodeStatus, setClaudeCodeStatus] = useState<ClaudeCodeStatus | null>(null);
  const [claudeCodeToken, setClaudeCodeToken] = useState('');
  const [importingClaudeCode, setImportingClaudeCode] = useState(false);

  const { data: llmProviders, error: llmError } = useSWR<LLMProvider[]>(
    'llm-providers',
    () => api.listLLMProviders()
  );

  const { data: embeddingProviders, error: embeddingError } = useSWR<EmbeddingProvider[]>(
    'embedding-providers',
    () => api.listEmbeddingProviders()
  );


  // Fetch Claude Code status when modal opens with claudecode selected
  useEffect(() => {
    if (isCreateProviderOpen && selectedProviderName === 'claudecode') {
      api.getClaudeCodeStatus().then(setClaudeCodeStatus).catch(() => setClaudeCodeStatus(null));
    }
  }, [isCreateProviderOpen, selectedProviderName]);

  const handleClaudeCodeAutoImport = async () => {
    setImportingClaudeCode(true);
    try {
      await api.autoImportClaudeCode();
      showToast('Claude Code credentials imported successfully!', 'success');
      mutate('llm-providers');
      setIsCreateProviderOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import credentials', 'error');
    } finally {
      setImportingClaudeCode(false);
    }
  };

  const handleClaudeCodeManualImport = async () => {
    if (!claudeCodeToken.trim()) return;
    setImportingClaudeCode(true);
    try {
      await api.importClaudeCode({
        access_token: claudeCodeToken.trim(),
        subscription_type: 'max', // Default to max, server can auto-detect
      });
      showToast('Claude Code token imported successfully!', 'success');
      setClaudeCodeToken('');
      mutate('llm-providers');
      setIsCreateProviderOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import token', 'error');
    } finally {
      setImportingClaudeCode(false);
    }
  };

  const handleSaveToken = () => {
    setToken(tokenInput);
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
  };


  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrapToken || !email || !name) return;

    setBootstrapping(true);
    setBootstrapResult(null);

    try {
      const newToken = await bootstrap(bootstrapToken, email, name);
      setBootstrapResult(`Success! Your API token: ${newToken}`);
      setTokenInput(newToken);
    } catch {
      // Error is handled in the store
    } finally {
      setBootstrapping(false);
    }
  };

  const handleCreateProvider = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    try {
      if (mainTab === 'llm') {
        // Build config object from form fields
        const config: Record<string, any> = {};
        const model = formData.get('model') as string;
        if (model) config.model = model;

        const data: LLMProviderCreateRequest = {
          name: formData.get('name') as 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'claudecode',
          auth_type: formData.get('auth_type') as 'api_key' | 'oauth',
          api_key: formData.get('api_key') as string || undefined,
          priority: formData.get('priority') ? Number(formData.get('priority')) : undefined,
          enabled: formData.get('enabled') === 'on',
          config: Object.keys(config).length > 0 ? config : undefined,
        };

        if (editingProvider) {
          await api.updateLLMProvider(editingProvider.id, data);
          showToast('LLM provider updated successfully', 'success');
        } else {
          await api.createLLMProvider(data);
          showToast('LLM provider created successfully', 'success');
        }
        mutate('llm-providers');
      } else {
        // Build config object from form fields
        const config: Record<string, any> = {};
        const model = formData.get('model') as string;
        if (model) config.model = model;
        const endpoint = formData.get('endpoint') as string;
        if (endpoint) config.endpoint = endpoint;

        const providerName = formData.get('name') as 'gemini' | 'openai' | 'ollama';
        const data: EmbeddingProviderCreateRequest = {
          name: providerName,
          auth_type: 'api_key',
          api_key: providerName !== 'ollama' ? formData.get('api_key') as string : undefined,
          priority: formData.get('priority') ? Number(formData.get('priority')) : undefined,
          search_priority: formData.get('search_priority') ? Number(formData.get('search_priority')) : undefined,
          enabled: formData.get('enabled') === 'on',
          config: Object.keys(config).length > 0 ? config : undefined,
        };

        if (editingProvider) {
          await api.updateEmbeddingProvider(editingProvider.id, data);
          showToast('Embedding provider updated successfully', 'success');
        } else {
          await api.createEmbeddingProvider(data);
          showToast('Embedding provider created successfully', 'success');
        }
        mutate('embedding-providers');
      }

      setIsCreateProviderOpen(false);
      setEditingProvider(null);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save provider', 'error');
    }
  };

  const handleDeleteProvider = async (id: string, type: 'llm' | 'embedding') => {
    if (!confirm('Delete this provider? This action cannot be undone.')) return;

    try {
      if (type === 'llm') {
        await api.deleteLLMProvider(id);
        mutate('llm-providers');
      } else {
        await api.deleteEmbeddingProvider(id);
        mutate('embedding-providers');
      }
      showToast('Provider deleted successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete provider', 'error');
    }
  };

  const handleTestProvider = async (id: string, type: 'llm' | 'embedding') => {
    setTestingProvider(id);

    try {
      const result = type === 'llm'
        ? await api.testLLMProvider(id)
        : await api.testEmbeddingProvider(id);

      if (result.success) {
        let message = result.message;
        if (result.latency_ms) {
          message += ` (${result.latency_ms}ms)`;
        }
        if (result.response_preview) {
          message += ` - ${result.response_preview}`;
        }
        showToast(message, 'success');
      } else {
        let errorMsg = result.message;
        if (result.error_code) {
          errorMsg += ` (${result.error_code})`;
        }
        if (result.error_details) {
          errorMsg += `: ${result.error_details}`;
        }
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to test connection', 'error');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleOAuthInit = () => {
    // Redirect to OAuth authorization URL
    const oauthUrl = api.getProviderOAuthUrl('llm', 'anthropic', 'console');
    window.location.href = oauthUrl;
  };

  const openCreateModal = () => {
    setEditingProvider(null);
    setSelectedProviderName('gemini');
    setSelectedAuthType('api_key');
    setIsCreateProviderOpen(true);
  };

  const openEditModal = (provider: LLMProvider | EmbeddingProvider) => {
    setEditingProvider(provider);
    setSelectedProviderName(provider.name);
    setSelectedAuthType((provider as LLMProvider).auth_type || 'api_key');
    setIsCreateProviderOpen(true);
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>Configure authentication and AI providers</p>
      </div>

      {/* Main Tabs */}
      <div className={styles.mainTabs}>
        <button
          className={`${styles.mainTab} ${mainTab === 'token' ? styles.active : ''}`}
          onClick={() => setMainTab('token')}
        >
          API Token
        </button>
        <button
          className={`${styles.mainTab} ${mainTab === 'oauth' ? styles.active : ''}`}
          onClick={() => setMainTab('oauth')}
        >
          OAuth Login
        </button>
        <button
          className={`${styles.mainTab} ${mainTab === 'bootstrap' ? styles.active : ''}`}
          onClick={() => setMainTab('bootstrap')}
        >
          Bootstrap
        </button>
        <button
          className={`${styles.mainTab} ${mainTab === 'llm' ? styles.active : ''}`}
          onClick={() => setMainTab('llm')}
        >
          LLM Providers
        </button>
        <button
          className={`${styles.mainTab} ${mainTab === 'embedding' ? styles.active : ''}`}
          onClick={() => setMainTab('embedding')}
        >
          Embedding Providers
        </button>
      </div>

      <div className={styles.container}>
        {/* Auth Status Card - shown for all auth tabs */}
        {(mainTab === 'token' || mainTab === 'oauth' || mainTab === 'bootstrap') && (
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Authentication Status</span>
              <div className={styles.authStatusRight}>
                <div
                  className={`${styles.statusBadge} ${
                    isAuthenticated ? styles.authenticated : styles.unauthenticated
                  }`}
                >
                  <span className={styles.statusDot} />
                  {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                </div>
                {isAuthenticated && (
                  <button onClick={clearAuth} className={styles.clearBtn}>
                    Clear Credentials
                  </button>
                )}
              </div>
            </div>
            {error && (
              <div className={styles.cardContent}>
                <p className={styles.error}>{error}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* API Token Tab */}
        {mainTab === 'token' && (
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>API Token</span>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.tabContent}>
                <p className={styles.description}>
                  Enter an existing API token to authenticate. API tokens can be created
                  by administrators or generated during bootstrap.
                </p>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>API Token</label>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="fold_xxxxxxxxxxxxxxxxxxxxxxxx"
                    className={styles.input}
                  />
                </div>
                <div className={styles.actions}>
                  <button
                    onClick={handleSaveToken}
                    disabled={!tokenInput}
                    className={styles.primaryBtn}
                  >
                    {tokenSaved ? 'Saved!' : 'Save Token'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* OAuth Login Tab */}
        {mainTab === 'oauth' && (
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>OAuth Login</span>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.tabContent}>
                <p className={styles.description}>
                  Log in using your existing OAuth provider account. Choose a provider below to authenticate.
                </p>

                {providers && providers.providers && providers.providers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {providers.providers.map((provider) => (
                      <a
                        key={provider.id}
                        href={`${API_BASE}/auth/login/${provider.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '1rem',
                          background: 'var(--elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          textDecoration: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          color: 'var(--text-primary)',
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLAnchorElement;
                          el.style.borderColor = 'var(--holo-cyan)';
                          el.style.background = 'var(--surface)';
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLAnchorElement;
                          el.style.borderColor = 'var(--border)';
                          el.style.background = 'var(--elevated)';
                        }}
                      >
                        {provider.icon && (
                          <img
                            src={provider.icon}
                            alt={provider.display_name}
                            style={{ width: '20px', height: '20px' }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            Continue with {provider.display_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            {provider.type === 'oidc' ? 'OpenID Connect' : 'OAuth 2.0'}
                          </div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className={styles.description} style={{ color: 'var(--text-secondary)' }}>
                    No OAuth providers are configured on this server.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Bootstrap Tab */}
        {mainTab === 'bootstrap' && (
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Bootstrap Admin</span>
            </div>
            <div className={styles.cardContent}>
              <form className={styles.tabContent} onSubmit={handleBootstrap}>
                <p className={styles.description}>
                  If this is a new Fold installation, use the bootstrap token (from your
                  server's ADMIN_BOOTSTRAP_TOKEN environment variable) to create the
                  first admin user.
                </p>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Bootstrap Token</label>
                  <input
                    type="password"
                    value={bootstrapToken}
                    onChange={(e) => setBootstrapToken(e.target.value)}
                    placeholder="Your ADMIN_BOOTSTRAP_TOKEN"
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Your Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Admin User"
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.actions}>
                  <button
                    type="submit"
                    disabled={bootstrapping || !bootstrapToken || !email || !name}
                    className={styles.primaryBtn}
                  >
                    {bootstrapping ? 'Creating...' : 'Create Admin User'}
                  </button>
                </div>

                {bootstrapResult && (
                  <div className={styles.resultBox}>
                    <p>{bootstrapResult}</p>
                    <p className={styles.resultNote}>
                      Save this token securely - it won't be shown again!
                    </p>
                  </div>
                )}
              </form>
            </div>
          </motion.div>
        )}

        {/* LLM Providers Tab */}
        {mainTab === 'llm' && (
          <>
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>LLM Providers</span>
                <button className={styles.primaryBtn} onClick={openCreateModal}>
                  Add Provider
                </button>
              </div>

              <div className={styles.cardContent}>
                {llmError && (
                  <div className={styles.error}>Failed to load providers. The endpoint may not be implemented yet.</div>
                )}

                {llmProviders && llmProviders.length > 0 ? (
                  <div className={styles.providerList}>
                    {llmProviders.map((provider) => {
                      const displayName = provider.name === 'claudecode'
                        ? 'Claude Code'
                        : provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
                      const model = provider.config?.model as string | undefined;
                      const subType = provider.config?.subscription_type as string | undefined;

                      return (
                        <div key={provider.id} className={styles.providerItem}>
                          <div className={styles.providerHeader}>
                            <div className={styles.providerName}>{displayName}</div>
                            <span className={`${styles.providerStatusBadge} ${provider.enabled ? styles.enabled : styles.disabled}`}>
                              <span className={styles.providerStatusDot} />
                              {provider.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className={styles.providerBody}>
                            <div className={styles.providerMeta}>
                              <span className={styles.providerType}>{provider.name}</span>
                              {provider.name !== 'claudecode' && (
                                <span className={styles.providerAuth}>{provider.auth_type}</span>
                              )}
                              {provider.name === 'claudecode' && subType && (
                                <span className={styles.providerAuth}>{subType}</span>
                              )}
                              {provider.has_api_key && provider.name !== 'claudecode' && (
                                <span className={styles.providerAuth}>API Key Set</span>
                              )}
                              {provider.has_oauth_token && (
                                <span className={styles.providerAuth}>
                                  OAuth {provider.oauth_token_expired ? '(Expired)' : 'Connected'}
                                </span>
                              )}
                              {model && <span className={styles.providerModel}>{model}</span>}
                              <span className={styles.providerPriority}>Priority: {provider.priority}</span>
                            </div>
                            <div className={styles.providerActions}>
                              <button
                                className={styles.testBtn}
                                onClick={() => handleTestProvider(provider.id, 'llm')}
                                disabled={testingProvider === provider.id}
                              >
                                {testingProvider === provider.id ? 'Testing...' : 'Test'}
                              </button>
                              <button
                                className={styles.editBtn}
                                onClick={() => openEditModal(provider)}
                                title="Edit"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                className={styles.deleteBtn}
                                onClick={() => handleDeleteProvider(provider.id, 'llm')}
                                title="Delete"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.noProviders}>
                    No LLM providers configured. Add a provider to enable AI-powered features.
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}

        {/* Embedding Providers Tab */}
        {mainTab === 'embedding' && (
          <>
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Embedding Providers</span>
                <button className={styles.primaryBtn} onClick={openCreateModal}>
                  Add Provider
                </button>
              </div>

              <div className={styles.cardContent}>
                {embeddingError && (
                  <div className={styles.error}>Failed to load providers. The endpoint may not be implemented yet.</div>
                )}

                <p className={styles.providerHint}>
                  Use high-quality embedders for indexing to ensure accurate semantic matching.
                  For search, simpler or local embedders can reduce latency.
                </p>

                {embeddingProviders && embeddingProviders.length > 0 ? (
                  <div className={styles.providerList}>
                    {embeddingProviders.map((provider) => {
                      const displayName = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
                      const model = provider.config?.model as string | undefined;

                      return (
                        <div key={provider.id} className={styles.providerItem}>
                          <div className={styles.providerHeader}>
                            <div className={styles.providerName}>{displayName}</div>
                            <span className={`${styles.providerStatusBadge} ${provider.enabled ? styles.enabled : styles.disabled}`}>
                              <span className={styles.providerStatusDot} />
                              {provider.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className={styles.providerBody}>
                            <div className={styles.providerMeta}>
                              <span className={styles.providerType}>{provider.name}</span>
                              {provider.has_api_key && (
                                <span className={styles.providerAuth}>API Key Set</span>
                              )}
                              {model && <span className={styles.providerModel}>{model}</span>}
                              <span className={styles.providerPriority}>Index: {provider.priority}</span>
                              <span className={styles.providerPriority}>Search: {provider.search_priority ?? provider.priority}</span>
                            </div>
                            <div className={styles.providerActions}>
                              <button
                                className={styles.testBtn}
                                onClick={() => handleTestProvider(provider.id, 'embedding')}
                                disabled={testingProvider === provider.id}
                              >
                                {testingProvider === provider.id ? 'Testing...' : 'Test'}
                              </button>
                              <button
                                className={styles.editBtn}
                                onClick={() => openEditModal(provider)}
                                title="Edit"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                className={styles.deleteBtn}
                                onClick={() => handleDeleteProvider(provider.id, 'embedding')}
                                title="Delete"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.noProviders}>
                    No embedding providers configured. Add a provider to enable semantic search.
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Provider Create/Edit Modal */}
      <Modal
        isOpen={isCreateProviderOpen}
        onClose={() => {
          setIsCreateProviderOpen(false);
          setEditingProvider(null);
        }}
        title={editingProvider ? 'Edit Provider' : 'Add Provider'}
        wide
        footer={
          <div className={styles.actions}>
            <button
              className={styles.clearBtn}
              onClick={() => {
                setIsCreateProviderOpen(false);
                setEditingProvider(null);
              }}
            >
              Cancel
            </button>
            {(selectedProviderName !== 'claudecode' || editingProvider) && (
              <button type="submit" form="provider-form" className={styles.primaryBtn}>
                {editingProvider ? 'Update Provider' : 'Create Provider'}
              </button>
            )}
          </div>
        }
      >
        <form id="provider-form" className={styles.tabContent} onSubmit={handleCreateProvider}>
          {/* Hidden input for auth_type when not Anthropic */}
          {mainTab === 'llm' && selectedProviderName !== 'anthropic' && selectedProviderName !== 'claudecode' && (
            <input type="hidden" name="auth_type" value="api_key" />
          )}

          {/* Top row: Provider (left) + API Key/URL (right) */}
          <div className={styles.formColumnsTop}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Provider *</label>
              <select
                name="name"
                className={styles.input}
                value={selectedProviderName}
                onChange={(e) => {
                  const name = e.target.value;
                  setSelectedProviderName(name);
                  // Reset to api_key when switching away from Anthropic
                  if (name !== 'anthropic') {
                    setSelectedAuthType('api_key');
                  }
                  // Fetch Claude Code status when selected
                  if (name === 'claudecode') {
                    api.getClaudeCodeStatus().then(setClaudeCodeStatus).catch(() => setClaudeCodeStatus(null));
                  }
                }}
                required
              >
                {mainTab === 'llm' ? (
                  <>
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude API)</option>
                    <option value="claudecode">Claude Code (Max/Pro subscription)</option>
                    <option value="openrouter">OpenRouter</option>
                  </>
                ) : (
                  <>
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="ollama">Ollama</option>
                  </>
                )}
              </select>
              {mainTab === 'llm' && selectedProviderName === 'anthropic' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label className={styles.label}>Authentication *</label>
                  <select
                    name="auth_type"
                    className={styles.input}
                    value={selectedAuthType}
                    onChange={(e) => setSelectedAuthType(e.target.value as 'api_key' | 'oauth')}
                    required
                  >
                    <option value="api_key">API Key</option>
                    <option value="oauth">OAuth</option>
                  </select>
                </div>
              )}
            </div>

            {/* API Key / URL on the right - only for non-Claude Code */}
            {selectedProviderName !== 'claudecode' && (
              <div className={styles.inputGroup}>
                {/* API Key for non-Ollama providers */}
                {(selectedProviderName !== 'anthropic' || selectedAuthType === 'api_key') && selectedProviderName !== 'ollama' && (
                  <>
                    <label className={styles.label}>
                      API Key {!editingProvider && '*'}
                    </label>
                    <input
                      type="password"
                      name="api_key"
                      className={styles.input}
                      placeholder={editingProvider ? '(unchanged)' : 'sk-...'}
                      required={!editingProvider}
                    />
                    {editingProvider && (
                      <p className={styles.hint}>Leave blank to keep existing key</p>
                    )}
                    {!editingProvider && selectedProviderName === 'anthropic' && (
                      <p className={styles.hint}>
                        Get your API key from{' '}
                        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                          Anthropic Console
                        </a>
                      </p>
                    )}
                    {!editingProvider && selectedProviderName === 'gemini' && (
                      <p className={styles.hint}>
                        Get your API key from{' '}
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                          Google AI Studio
                        </a>
                      </p>
                    )}
                    {!editingProvider && selectedProviderName === 'openai' && (
                      <p className={styles.hint}>
                        Get your API key from{' '}
                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                          OpenAI Platform
                        </a>
                      </p>
                    )}
                  </>
                )}

                {/* Custom URL for Ollama */}
                {selectedProviderName === 'ollama' && (
                  <>
                    <label className={styles.label}>Custom URL</label>
                    <input
                      type="text"
                      name="endpoint"
                      className={styles.input}
                      placeholder="http://localhost:11434"
                      defaultValue={editingProvider?.config?.endpoint as string || ''}
                    />
                    <p className={styles.hint}>
                      Ollama runs locally. Leave blank to use default{' '}
                      <code>http://localhost:11434</code>
                    </p>
                  </>
                )}

                {/* OAuth link for Anthropic */}
                {selectedProviderName === 'anthropic' && selectedAuthType === 'oauth' && (
                  <p className={styles.description}>
                    <button type="button" onClick={handleOAuthInit} className={styles.linkBtn}>
                      Click here to authorize with Anthropic
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Claude Code special form */}
          {selectedProviderName === 'claudecode' && !editingProvider && (
            <div className={styles.claudeCodeForm}>
              {claudeCodeStatus?.detected ? (
                <div className={styles.detectedBox}>
                  <div className={styles.detectedInfo}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <path d="M22 4L12 14.01l-3-3" />
                    </svg>
                    <span>Credentials detected ({claudeCodeStatus.info?.subscription_type})</span>
                  </div>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={handleClaudeCodeAutoImport}
                    disabled={importingClaudeCode}
                  >
                    {importingClaudeCode ? 'Importing...' : 'Import'}
                  </button>
                </div>
              ) : (
                <p className={styles.description}>No Claude Code credentials detected</p>
              )}

              <div className={styles.divider}><span>or paste token manually</span></div>

              <p className={styles.hint}>
                Run <code>claude setup-token</code> in your terminal to get a token
              </p>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Access Token</label>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="sk-ant-oat-..."
                  value={claudeCodeToken}
                  onChange={(e) => setClaudeCodeToken(e.target.value)}
                />
              </div>

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleClaudeCodeManualImport}
                disabled={importingClaudeCode || !claudeCodeToken.trim()}
              >
                {importingClaudeCode ? 'Importing...' : 'Import Token'}
              </button>
            </div>
          )}

          {/* Claude Code edit form */}
          {selectedProviderName === 'claudecode' && editingProvider && (
            <div className={styles.claudeCodeForm}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Model (optional)</label>
                <input
                  type="text"
                  name="model"
                  className={styles.input}
                  placeholder="claude-opus-4-5-20250514"
                  defaultValue={editingProvider?.config?.model as string | undefined}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Priority</label>
                <input
                  type="number"
                  name="priority"
                  className={styles.input}
                  placeholder="1"
                  defaultValue={editingProvider?.priority || 1}
                  min="1"
                />
                <p className={styles.description}>Lower numbers = higher priority</p>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={editingProvider?.enabled ?? true}
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <input type="hidden" name="auth_type" value="oauth" />
            </div>
          )}

          {/* Hide these fields for Claude Code since it uses a different import flow */}
          {selectedProviderName !== 'claudecode' && (
            <>
              <div className={styles.formColumns}>
                {/* Left column - Model Configuration */}
                <div className={styles.formColumn}>
                  <div className={styles.formSection}>
                    <h4 className={styles.formSectionTitle}>Model Configuration</h4>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Model (optional)</label>
                      <input
                        type="text"
                        name="model"
                        className={styles.input}
                        placeholder="gpt-4, claude-3-opus, etc."
                        defaultValue={editingProvider?.config?.model as string | undefined}
                      />
                      <p className={styles.hint}>
                        Find model codes: {' '}
                        {selectedProviderName === 'gemini' && (
                          <a href="https://ai.google.dev/gemini-api/docs/models/gemini" target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                            Gemini models
                          </a>
                        )}
                        {selectedProviderName === 'openai' && (
                          <a href="https://platform.openai.com/docs/models" target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                            OpenAI models
                          </a>
                        )}
                        {selectedProviderName === 'anthropic' && (
                          <a href="https://docs.anthropic.com/en/docs/about-claude/models" target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                            Claude models
                          </a>
                        )}
                        {selectedProviderName === 'openrouter' && (
                          <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                            OpenRouter models
                          </a>
                        )}
                        {selectedProviderName === 'ollama' && (
                          <a href="https://ollama.ai/library" target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                            Ollama model library
                          </a>
                        )}
                      </p>
                    </div>

                    {/* Ollama model suggestions */}
                    {selectedProviderName === 'ollama' && mainTab === 'embedding' && (
                      <div className={styles.modelSuggestions}>
                        <p className={styles.description} style={{ marginBottom: '0.5rem' }}>
                          <strong>Recommended models (Feb 2026):</strong>
                        </p>
                        <ul className={styles.modelList}>
                          <li>
                            <button type="button" className={styles.modelBtn} onClick={() => {
                              const modelInput = document.querySelector('input[name="model"]') as HTMLInputElement;
                              if (modelInput) modelInput.value = 'nomic-embed-text';
                            }}>nomic-embed-text</button>
                            <span> - Best all-round, 768d</span>
                          </li>
                          <li>
                            <button type="button" className={styles.modelBtn} onClick={() => {
                              const modelInput = document.querySelector('input[name="model"]') as HTMLInputElement;
                              if (modelInput) modelInput.value = 'mxbai-embed-large';
                            }}>mxbai-embed-large</button>
                            <span> - High quality</span>
                          </li>
                          <li>
                            <button type="button" className={styles.modelBtn} onClick={() => {
                              const modelInput = document.querySelector('input[name="model"]') as HTMLInputElement;
                              if (modelInput) modelInput.value = 'bge-base-en-v1.5';
                            }}>bge-base-en-v1.5</button>
                            <span> - Retrieval optimised</span>
                          </li>
                        </ul>
                        <p className={styles.hint}>
                          Run <code>ollama pull nomic-embed-text</code> to download
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right column - Priority & Status */}
                <div className={styles.formColumn}>
                  <div className={styles.formSection}>
                    <h4 className={styles.formSectionTitle}>Priority & Status</h4>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>{mainTab === 'embedding' ? 'Priority (Indexing)' : 'Priority'}</label>
                      <input
                        type="number"
                        name="priority"
                        className={styles.input}
                        placeholder="1"
                        defaultValue={editingProvider?.priority || 1}
                        min="1"
                      />
                      <p className={styles.description}>Lower numbers = higher priority</p>
                    </div>

                    {mainTab === 'embedding' && (
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Priority (Search)</label>
                        <input
                          type="number"
                          name="search_priority"
                          className={styles.input}
                          placeholder="Same as indexing"
                          defaultValue={(editingProvider as EmbeddingProvider | null)?.search_priority || ''}
                          min="1"
                        />
                        <p className={styles.description}>Optional. If empty, uses indexing priority</p>
                      </div>
                    )}

                    <div className={styles.inputGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={editingProvider?.enabled ?? true}
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
