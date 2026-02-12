import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api, API_BASE } from '../lib/api';
import type { LLMProvider, LLMProviderCreateRequest, EmbeddingProvider, EmbeddingProviderCreateRequest, ConnectedAccount } from '../lib/api';
import { useAuth } from '../stores/auth';
import { Modal } from '../components/ui';
import { useToast } from '../components/ToastContext';
import styles from './Settings.module.css';

export function Settings() {
  const { token, isAuthenticated, setToken, clearAuth, bootstrap, error } = useAuth();
  const { showToast } = useToast();
  const [mainTab, setMainTab] = useState<'token' | 'oauth' | 'bootstrap' | 'accounts' | 'llm' | 'embedding'>('token');

  // Connected accounts
  const { data: connectionsData, mutate: mutateConnections } = useSWR(
    isAuthenticated ? 'connections' : null,
    () => api.getConnections()
  );
  const [pollingForConnection, setPollingForConnection] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const connectionsSnapshotRef = useRef<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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



  // Model list fetching
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelValue, setModelValue] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modelsFetchedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close model dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelInputRef.current && !modelInputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position when open
  const updateDropdownPos = useCallback(() => {
    if (modelInputRef.current) {
      const rect = modelInputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    if (modelDropdownOpen) {
      updateDropdownPos();
      window.addEventListener('scroll', updateDropdownPos, true);
      window.addEventListener('resize', updateDropdownPos);
      return () => {
        window.removeEventListener('scroll', updateDropdownPos, true);
        window.removeEventListener('resize', updateDropdownPos);
      };
    }
  }, [modelDropdownOpen, updateDropdownPos]);

  const { data: llmProviders, error: llmError } = useSWR<LLMProvider[]>(
    'llm-providers',
    () => api.listLLMProviders()
  );

  const { data: embeddingProviders, error: embeddingError } = useSWR<EmbeddingProvider[]>(
    'embedding-providers',
    () => api.listEmbeddingProviders()
  );


  const fetchModelList = async () => {
    setModelsLoading(true);
    setModelsError(null);
    setAvailableModels([]);
    setModelSearch('');

    try {
      let baseUrl = '';
      const apiKeyInput = document.querySelector('input[name="api_key"]') as HTMLInputElement;
      const apiKey = apiKeyInput?.value || '';

      switch (selectedProviderName) {
        case 'openai':
          baseUrl = 'https://api.openai.com/v1';
          break;
        case 'anthropic':
          baseUrl = 'https://api.anthropic.com/v1';
          break;
        case 'openrouter':
          baseUrl = 'https://openrouter.ai/api/v1';
          break;
        case 'gemini':
          baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
          break;
        case 'openai_compat':
        case 'ollama': {
          const endpointInput = document.querySelector('input[name="endpoint"]') as HTMLInputElement;
          baseUrl = endpointInput?.value || '';
          break;
        }
      }

      if (!baseUrl) {
        setModelsError('Enter a base URL first');
        return;
      }

      let models: string[] = [];

      if (selectedProviderName === 'gemini') {
        const url = apiKey
          ? `${baseUrl}/models?key=${apiKey}`
          : `${baseUrl}/models`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        models = (data.models || [])
          .map((m: any) => (m.name || '').replace(/^models\//, ''))
          .filter((n: string) => n.startsWith('gemini'));
      } else if (selectedProviderName === 'anthropic') {
        const res = await fetch(`${baseUrl}/models`, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        models = (data.data || []).map((m: any) => m.id);
      } else {
        const headers: HeadersInit = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(`${baseUrl}/models`, { headers });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const list = data.data || data.models || [];
        models = list.map((m: any) => m.id || m.name || '');
      }

      const sorted = models.filter(Boolean).sort();
      setAvailableModels(sorted);
      if (sorted.length === 0) {
        setModelsError('No models found');
      } else {
        setModelSearch(modelValue);
        setModelDropdownOpen(true);
      }
    } catch {
      setModelsError('Unable to get models');
    } finally {
      setModelsLoading(false);
    }
  };

  // Retry model fetch when API key or URL changes after a failure
  const retryModelFetch = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      modelsFetchedRef.current = true;
      fetchModelList();
    }, 600);
  }, [selectedProviderName]);

  const handleSaveToken = () => {
    setToken(tokenInput);
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
  };

  // Connected accounts helpers
  const connectUrl = (provider: string) => {
    const t = api.getToken();
    const base = `${API_BASE}/auth/connect/${provider}`;
    return t ? `${base}?token=${encodeURIComponent(t)}` : base;
  };

  const handleConnectClick = () => {
    const connections = connectionsData?.connections || [];
    connectionsSnapshotRef.current = connections.map((c) => c.updated_at).sort().join(',');
    setPollingForConnection(true);
  };

  // Poll for new/updated connections after connect click
  useEffect(() => {
    if (!pollingForConnection) return;
    pollingRef.current = setInterval(() => {
      api.getConnections().then((res) => {
        const newSnapshot = res.connections.map((c) => c.updated_at).sort().join(',');
        if (newSnapshot !== connectionsSnapshotRef.current) {
          mutateConnections(res, false);
          setPollingForConnection(false);
          showToast('Account connected', 'success');
        }
      }).catch(() => {});
    }, 1000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [pollingForConnection, mutateConnections, showToast]);

  // Stop polling when leaving accounts tab
  useEffect(() => {
    if (mainTab !== 'accounts') setPollingForConnection(false);
  }, [mainTab]);

  const handleDisconnect = async (account: ConnectedAccount) => {
    if (!confirm(`Disconnect ${account.username} (${account.provider})? Projects using this account will keep their existing token.`)) return;
    setDisconnecting(account.id);
    try {
      await api.deleteConnection(account.id);
      mutateConnections();
      showToast('Account disconnected', 'success');
    } catch {
      showToast('Failed to disconnect account', 'error');
    } finally {
      setDisconnecting(null);
    }
  };

  const isTokenExpired = (account: ConnectedAccount) => {
    if (!account.token_expires_at) return false;
    return new Date(account.token_expires_at) < new Date();
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
        const endpoint = formData.get('endpoint') as string;
        if (endpoint) config.endpoint = endpoint;

        const providerName = formData.get('name') as LLMProviderCreateRequest['name'];

        // For openai_compat, store provider_type in config so the backend dispatches correctly
        if (providerName === 'openai_compat') {
          config.provider_type = 'openai_compat';
        }

        const data: LLMProviderCreateRequest = {
          name: providerName,
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
    setModelValue('');
    setAvailableModels([]);
    setModelsError(null);
    setModelSearch('');
    modelsFetchedRef.current = false;
    setIsCreateProviderOpen(true);
  };

  const openEditModal = (provider: LLMProvider | EmbeddingProvider) => {
    setEditingProvider(provider);
    setSelectedProviderName(provider.name);
    setSelectedAuthType((provider as LLMProvider).auth_type || 'api_key');
    setModelValue((provider.config?.model as string) || '');
    setAvailableModels([]);
    setModelsError(null);
    setModelSearch('');
    modelsFetchedRef.current = false;
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
          className={`${styles.mainTab} ${mainTab === 'accounts' ? styles.active : ''}`}
          onClick={() => setMainTab('accounts')}
        >
          Accounts
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

        {/* Connected Accounts Tab */}
        {mainTab === 'accounts' && (
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Connected Accounts</span>
              <div className={styles.connectActions}>
                <a
                  href={connectUrl('github')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.primaryBtn}
                  onClick={handleConnectClick}
                  style={{ textDecoration: 'none' }}
                >
                  Connect GitHub
                </a>
              </div>
            </div>

            <div className={styles.cardContent}>
              <p className={styles.description}>
                Connected accounts are used when creating projects from GitHub repositories. Tokens are refreshed automatically but expire after approximately 8 hours.
              </p>

              {pollingForConnection && (
                <div className={styles.providerHint}>
                  Waiting for connection... Complete the authorisation in the new tab.
                </div>
              )}

              {connectionsData && connectionsData.connections.length > 0 ? (
                <div className={styles.providerList}>
                  {connectionsData.connections.map((account) => {
                    const expired = isTokenExpired(account);
                    return (
                      <div key={account.id} className={styles.providerItem}>
                        <div className={styles.providerHeader}>
                          <div className={styles.providerName}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>
                              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            {account.username}
                          </div>
                          <span className={`${styles.providerStatusBadge} ${expired ? styles.disabled : styles.enabled}`}>
                            <span className={styles.providerStatusDot} />
                            {expired ? 'Expired' : 'Active'}
                          </span>
                        </div>
                        <div className={styles.providerBody}>
                          <div className={styles.providerMeta}>
                            <span className={styles.providerType}>{account.provider}</span>
                            {account.scopes && <span className={styles.providerAuth}>{account.scopes}</span>}
                            <span className={styles.accountMeta}>
                              Connected {new Date(account.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className={styles.providerActions}>
                            <a
                              href={connectUrl(account.provider)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.testBtn}
                              onClick={handleConnectClick}
                              style={{ textDecoration: 'none' }}
                            >
                              Reconnect
                            </a>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDisconnect(account)}
                              disabled={disconnecting === account.id}
                              title="Disconnect"
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
                  No accounts connected. Connect a GitHub account to create projects from repositories.
                </p>
              )}
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
                      const displayName = provider.name === 'openai_compat'
                        ? 'OpenAI Compatible'
                        : provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
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
                              <span className={styles.providerAuth}>{provider.auth_type}</span>
                              {provider.has_api_key && (
                                <span className={styles.providerAuth}>API Key Set</span>
                              )}
                              {provider.has_oauth_token && (
                                <span className={styles.providerAuth}>
                                  OAuth {provider.oauth_token_expired ? '(Expired)' : 'Connected'}
                                </span>
                              )}
                              {model && <span className={styles.providerModel}>{model}</span>}
                              {provider.name === 'openai_compat' && provider.config?.endpoint && (
                                <span className={styles.providerModel}>{provider.config.endpoint as string}</span>
                              )}
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
          setAvailableModels([]);
          setModelsError(null);
          setModelSearch('');
          setModelDropdownOpen(false);
          setModelValue('');
          modelsFetchedRef.current = false;
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
            <button type="submit" form="provider-form" className={styles.primaryBtn}>
              {editingProvider ? 'Update Provider' : 'Create Provider'}
            </button>
          </div>
        }
      >
        <form id="provider-form" className={styles.tabContent} onSubmit={handleCreateProvider}>
          {/* Hidden input for auth_type when not Anthropic */}
          {mainTab === 'llm' && selectedProviderName !== 'anthropic' && (
            <input type="hidden" name="auth_type" value="api_key" />
          )}

          {/* Top row: Provider (left) + Model config (right) */}
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
                  setAvailableModels([]);
                  setModelsError(null);
                  setModelSearch('');
                  setModelValue('');
                  modelsFetchedRef.current = false;
                  // Reset to api_key when switching away from Anthropic
                  if (name !== 'anthropic') {
                    setSelectedAuthType('api_key');
                  }
                }}
                required
              >
                {mainTab === 'llm' ? (
                  <>
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude API)</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai_compat">OpenAI Compatible (v1)</option>
                  </>
                ) : (
                  <>
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="ollama">Ollama</option>
                    <option value="openrouter">OpenRouter</option>
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

            {/* Model config on the right */}
            <div className={styles.inputGroup}>
                <label className={styles.label}>Model (optional)</label>
                <input type="hidden" name="model" value={modelValue} />
                <input
                  ref={modelInputRef}
                  type="text"
                  className={styles.input}
                  placeholder={modelsLoading ? 'Fetching models...' : 'gpt-4, claude-3-opus, etc.'}
                  value={modelDropdownOpen ? modelSearch : modelValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (modelDropdownOpen) {
                      setModelSearch(val);
                      setHighlightedIndex(-1);
                    } else {
                      setModelValue(val);
                      setModelSearch(val);
                    }
                  }}
                  onFocus={() => {
                    if (!modelsFetchedRef.current && !modelsLoading) {
                      modelsFetchedRef.current = true;
                      fetchModelList();
                    }
                    if (availableModels.length > 0) {
                      setModelSearch(modelValue);
                      setModelDropdownOpen(true);
                      setHighlightedIndex(-1);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!modelDropdownOpen || availableModels.length === 0) return;
                    const filtered = availableModels.filter((m) =>
                      m.toLowerCase().includes(modelSearch.toLowerCase())
                    );
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
                      e.preventDefault();
                      setModelValue(filtered[highlightedIndex]);
                      setModelDropdownOpen(false);
                      setHighlightedIndex(-1);
                    } else if (e.key === 'Escape') {
                      setModelDropdownOpen(false);
                      setHighlightedIndex(-1);
                    }
                  }}
                />
                {modelsError && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {modelsError}
                  </span>
                )}

                <p className={styles.hint}>
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
                  {selectedProviderName === 'openai_compat' && (
                    <span className={styles.hint}>
                      The model name to pass to your proxy. Leave blank to use the proxy's default.
                    </span>
                  )}
                </p>
              </div>
          </div>

          {/* Bottom row: API Key/URL (left) + Priority & Status (right) */}
          <div className={styles.formColumns}>
            {/* Left column - Authentication / Connection */}
            <div className={styles.formColumn}>
              <div className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Authentication</h4>
                {/* API Key for providers that need it (not Ollama, not openai_compat) */}
                {(selectedProviderName !== 'anthropic' || selectedAuthType === 'api_key') && selectedProviderName !== 'ollama' && selectedProviderName !== 'openai_compat' && (
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
                      onChange={() => {
                        if (modelsError || availableModels.length === 0) retryModelFetch();
                      }}
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
                  </div>
                )}

                {/* Custom URL for Ollama */}
                {selectedProviderName === 'ollama' && (
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Custom URL</label>
                    <input
                      type="text"
                      name="endpoint"
                      className={styles.input}
                      placeholder="http://localhost:11434"
                      defaultValue={editingProvider?.config?.endpoint as string || ''}
                      onChange={() => {
                        if (modelsError || availableModels.length === 0) retryModelFetch();
                      }}
                    />
                    <p className={styles.hint}>
                      Ollama runs locally. Leave blank to use default{' '}
                      <code>http://localhost:11434</code>
                    </p>
                  </div>
                )}

                {/* Endpoint + optional API key for OpenAI Compatible */}
                {selectedProviderName === 'openai_compat' && (
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Base URL *</label>
                    <input
                      type="text"
                      name="endpoint"
                      className={styles.input}
                      placeholder="http://localhost:8080/v1"
                      defaultValue={editingProvider?.config?.endpoint as string || ''}
                      required
                      onChange={() => {
                        if (modelsError || availableModels.length === 0) retryModelFetch();
                      }}
                    />
                    <p className={styles.hint}>
                      The base URL of your OpenAI-compatible API (e.g. LiteLLM, vLLM, LocalAI, CLI Proxy)
                    </p>

                    <label className={styles.label} style={{ marginTop: '0.75rem' }}>API Key (optional)</label>
                    <input
                      type="password"
                      name="api_key"
                      className={styles.input}
                      placeholder={editingProvider ? '(unchanged)' : 'Leave blank if not required'}
                      onChange={() => {
                        if (modelsError || availableModels.length === 0) retryModelFetch();
                      }}
                    />
                    <p className={styles.hint}>
                      Only needed if your proxy requires authentication
                    </p>
                  </div>
                )}

                {/* OAuth link for Anthropic */}
                {selectedProviderName === 'anthropic' && selectedAuthType === 'oauth' && (
                  <p className={styles.description}>
                    <button type="button" onClick={handleOAuthInit} className={styles.linkBtn}>
                      Click here to authorize with Anthropic
                    </button>
                  </p>
                )}

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
        </form>
      </Modal>

      {/* Floating model dropdown rendered via portal to escape modal overflow */}
      {modelDropdownOpen && availableModels.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: '240px',
            overflowY: 'auto',
            background: 'var(--surface, #1e1e1e)',
            border: '1px solid var(--border, #333)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 10000,
          }}
        >
          {(() => {
            const filtered = availableModels.filter((m) =>
              m.toLowerCase().includes(modelSearch.toLowerCase())
            );
            if (filtered.length === 0) {
              return (
                <div style={{ padding: '0.5rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  No matching models
                </div>
              );
            }
            return filtered.map((model, idx) => (
              <div
                key={model}
                ref={(el) => {
                  if (idx === highlightedIndex && el) {
                    el.scrollIntoView({ block: 'nearest' });
                  }
                }}
                style={{
                  padding: '0.35rem 0.6rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  borderBottom: '1px solid var(--border, #333)',
                  background: idx === highlightedIndex ? 'var(--elevated, #2a2a2a)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  setHighlightedIndex(idx);
                  e.currentTarget.style.background = 'var(--elevated, #2a2a2a)';
                }}
                onMouseLeave={(e) => {
                  if (idx !== highlightedIndex) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                onClick={() => {
                  setModelValue(model);
                  setModelDropdownOpen(false);
                  setHighlightedIndex(-1);
                }}
              >
                {model}
              </div>
            ));
          })()}
        </div>,
        document.body
      )}
    </>
  );
}
