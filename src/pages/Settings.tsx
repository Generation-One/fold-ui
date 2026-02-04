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
  const [mainTab, setMainTab] = useState<'authentication' | 'providers'>('authentication');
  const [authTab, setAuthTab] = useState<'token' | 'oauth' | 'bootstrap'>('token');

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
  const [providerTab, setProviderTab] = useState<'llm' | 'embedding'>('llm');
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
      if (providerTab === 'llm') {
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
        const dimension = formData.get('dimension') as string;
        if (dimension) config.dimension = Number(dimension);

        const data: EmbeddingProviderCreateRequest = {
          name: formData.get('name') as 'gemini' | 'openai',
          auth_type: 'api_key',
          api_key: formData.get('api_key') as string,
          priority: formData.get('priority') ? Number(formData.get('priority')) : undefined,
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
        <p className={styles.pageSubtitle}>Configure authentication and API access</p>
      </div>

      {/* Main Tabs */}
      <div className={styles.mainTabs}>
        <button
          className={`${styles.mainTab} ${mainTab === 'authentication' ? styles.active : ''}`}
          onClick={() => setMainTab('authentication')}
        >
          Authentication
        </button>
        <button
          className={`${styles.mainTab} ${mainTab === 'providers' ? styles.active : ''}`}
          onClick={() => setMainTab('providers')}
        >
          AI Providers
        </button>
      </div>

      <div className={styles.container}>
        {/* Authentication Tab */}
        {mainTab === 'authentication' && (
          <>
            {/* Auth Status Card */}
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Authentication Status</span>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.authStatus}>
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
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </motion.div>

        {/* Auth Method Tabs */}
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${authTab === 'token' ? styles.active : ''}`}
              onClick={() => setAuthTab('token')}
            >
              API Token
            </button>
<button
              className={`${styles.tab} ${authTab === 'oauth' ? styles.active : ''}`}
              onClick={() => setAuthTab('oauth')}
            >
              OAuth Login
            </button>
            <button
              className={`${styles.tab} ${authTab === 'bootstrap' ? styles.active : ''}`}
              onClick={() => setAuthTab('bootstrap')}
            >
              Bootstrap Admin
            </button>
          </div>

          <div className={styles.cardContent}>
            {authTab === 'token' && (
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
            )}

{authTab === 'oauth' && (
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
            )}

            {authTab === 'bootstrap' && (
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
            )}
          </div>
        </motion.div>

        {/* OAuth Providers */}
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>OAuth Providers</span>
          </div>
          <div className={styles.cardContent}>
            {providers?.providers && providers.providers.length > 0 ? (
              <div className={styles.providerList}>
                {providers.providers.map((provider) => (
                  <a
                    key={provider.id}
                    href={`${API_BASE}/auth/login/${provider.id}`}
                    className={styles.providerBtn}
                  >
                    <span className={styles.providerIcon}>
                      {provider.icon === 'github' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      ) : provider.icon === 'google' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      )}
                    </span>
                    {provider.display_name}
                  </a>
                ))}
              </div>
            ) : (
              <p className={styles.noProviders}>
                No OAuth providers configured. Configure providers via environment
                variables (AUTH_PROVIDER_*) to enable OAuth login.
              </p>
            )}
          </div>
        </motion.div>
          </>
        )}

        {/* Providers Tab */}
        {mainTab === 'providers' && (
          <>
            {/* LLM & Embedding Providers */}
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>LLM & Embedding Providers</span>
            <button className={styles.primaryBtn} onClick={openCreateModal}>
              Add Provider
            </button>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${providerTab === 'llm' ? styles.active : ''}`}
              onClick={() => setProviderTab('llm')}
            >
              LLM Providers
            </button>
            <button
              className={`${styles.tab} ${providerTab === 'embedding' ? styles.active : ''}`}
              onClick={() => setProviderTab('embedding')}
            >
              Embedding Providers
            </button>
          </div>

          <div className={styles.cardContent}>
            {(llmError || embeddingError) && (
              <div className={styles.error}>Failed to load providers. The endpoint may not be implemented yet.</div>
            )}

            {providerTab === 'llm' ? (
              <>
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
                          <div className={styles.providerInfo}>
                            <div className={styles.providerName}>{displayName}</div>
                            <div className={styles.providerMeta}>
                              <span className={styles.providerType}>{provider.name}</span>
                              {provider.name !== 'claudecode' && (
                                <span className={styles.providerAuth}>{provider.auth_type}</span>
                              )}
                              {provider.name === 'claudecode' && subType && (
                                <span className={styles.providerAuth}>{subType}</span>
                              )}
                              <span className={`${styles.statusBadge} ${provider.enabled ? styles.authenticated : styles.unauthenticated}`}>
                                <span className={styles.statusDot} />
                                {provider.enabled ? 'Enabled' : 'Disabled'}
                              </span>
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
                            >
                              Edit
                            </button>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDeleteProvider(provider.id, 'llm')}
                            >
                              Delete
                            </button>
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
              </>
            ) : (
              <>
                {embeddingProviders && embeddingProviders.length > 0 ? (
                  <div className={styles.providerList}>
                    {embeddingProviders.map((provider) => {
                      const displayName = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
                      const model = provider.config?.model as string | undefined;
                      const dimension = provider.config?.dimension as number | undefined;

                      return (
                        <div key={provider.id} className={styles.providerItem}>
                          <div className={styles.providerInfo}>
                            <div className={styles.providerName}>{displayName}</div>
                            <div className={styles.providerMeta}>
                              <span className={styles.providerType}>{provider.name}</span>
                              <span className={`${styles.statusBadge} ${provider.enabled ? styles.authenticated : styles.unauthenticated}`}>
                                <span className={styles.statusDot} />
                                {provider.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                              {provider.has_api_key && (
                                <span className={styles.providerAuth}>API Key Set</span>
                              )}
                              {model && <span className={styles.providerModel}>{model}</span>}
                              {dimension && <span className={styles.providerDimension}>Dim: {dimension}</span>}
                              <span className={styles.providerPriority}>Priority: {provider.priority}</span>
                            </div>
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
                            >
                              Edit
                            </button>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDeleteProvider(provider.id, 'embedding')}
                            >
                              Delete
                            </button>
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
              </>
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
              {providerTab === 'llm' ? (
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
                </>
              )}
            </select>
          </div>

          {providerTab === 'llm' && selectedProviderName === 'anthropic' && (
            <div className={styles.inputGroup}>
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

          {/* Hidden input for auth_type when not Anthropic */}
          {providerTab === 'llm' && selectedProviderName !== 'anthropic' && selectedProviderName !== 'claudecode' && (
            <input type="hidden" name="auth_type" value="api_key" />
          )}

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

          {/* API Key for non-Claude Code providers */}
          {selectedProviderName !== 'claudecode' && (selectedProviderName !== 'anthropic' || selectedAuthType === 'api_key') && (
            <div className={styles.inputGroup}>
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
                  {' '}(Claude Code credentials won't work here)
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
            </div>
          )}

          {selectedProviderName === 'anthropic' && selectedAuthType === 'oauth' && (
            <div className={styles.inputGroup}>
              <p className={styles.description}>
                <button type="button" onClick={handleOAuthInit} className={styles.linkBtn}>
                  Click here to authorize with Anthropic
                </button>
              </p>
            </div>
          )}

          {/* Hide these fields for Claude Code since it uses a different import flow */}
          {selectedProviderName !== 'claudecode' && (
            <>
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
                </p>
              </div>

              {providerTab === 'embedding' && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Dimension (optional)</label>
                  <input
                    type="number"
                    name="dimension"
                    className={styles.input}
                    placeholder="1536"
                    defaultValue={editingProvider?.config?.dimension as number | undefined}
                  />
                </div>
              )}

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
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
