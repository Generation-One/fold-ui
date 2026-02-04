// Fold API Client

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8765';

// Types
export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  database: {
    connected: boolean;
    pool_size: number;
    active_connections: number;
  };
  qdrant: {
    connected: boolean;
    collections: number;
    total_points: number;
  };
  llm: {
    available: boolean;
    provider_count: number;
    active_provider?: string;
  };
  embeddings: {
    model: string;
    loaded: boolean;
    dimension: number;
  };
  jobs: {
    pending: number;
    running: number;
    paused: number;
    failed_24h: number;
  };
  metrics: {
    total_requests: number;
    total_errors: number;
    memory_usage_mb: number;
  };
}

export interface Job {
  id: string;
  type: 'index_repo' | 'reindex_repo' | 'sync_metadata' | 'index_history' | string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retry' | 'cancelled' | 'paused';
  project_id?: string;
  repository_id?: string;
  priority?: number;
  processed_items?: number;
  total_items?: number;
  progress?: number;
  payload?: Record<string, unknown>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface JobLog {
  id: number;
  job_id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description?: string;
  root_path?: string;
  created_at: string;
  updated_at: string;
}

export interface AlgorithmConfig {
  strength_weight: number;       // 0.0-1.0, default 0.3
  decay_half_life_days: number;  // min 1.0, default 30.0
}

export interface Repository {
  id: string;
  project_id: string;
  provider: 'git-hub' | 'git-lab';
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  auto_index: boolean;
  polling_enabled: boolean;
  polling_interval_secs?: number;
  /** Local filesystem path where the repository is cloned */
  local_path?: string;
  /** HEAD commit SHA of the local clone */
  head_sha?: string;
  last_indexed_at?: string;
  last_polled_at?: string;
  webhook_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface RepositoryUpdateRequest {
  auto_index?: boolean;
  polling_enabled?: boolean;
  polling_interval_secs?: number;
}

// URL-based repository creation (preferred)
export interface RepositoryCreateByUrl {
  url: string;
  access_token: string;
  auto_index?: boolean;
}

// Explicit field-based repository creation (backwards compatible)
export interface RepositoryCreateByFields {
  provider: 'git-hub' | 'git-lab';
  owner: string;
  name: string;
  default_branch?: string;
  access_token: string;
  auto_index?: boolean;
}

export type RepositoryCreateRequest = RepositoryCreateByUrl | RepositoryCreateByFields;

export type MemorySource = 'file' | 'manual' | 'generated';

export interface Memory {
  id: string;
  project_id: string;
  repository_id?: string;

  // Content reference (actual content in fold/)
  content_hash: string;
  hash_prefix: string;

  // Source tracking
  source: MemorySource;
  file_path?: string;
  language?: string;

  // Metadata
  title?: string;
  author?: string;
  tags?: string[];

  // Agentic metadata (auto-extracted)
  keywords?: string[];
  context?: string;
  links?: string[];

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface MemoryLink {
  id: string;
  project_id: string;
  source_id: string;
  target_id: string;
  link_type: 'related' | 'references' | 'depends_on' | 'modifies';
  context?: string;
  created_at: string;
}

export interface MemoryContext {
  memory: Memory;
  content: string;
  related: Array<{ memory: Memory; content: string; link_type?: string }>;
  depth: number;
}

export interface AuthProvider {
  id: string;
  display_name: string;
  icon?: string;
  type: string;
}

export interface LLMProvider {
  id: string;
  name: 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'claudecode';
  enabled: boolean;
  priority: number;
  auth_type: 'api_key' | 'oauth';
  has_api_key: boolean;
  has_oauth_token: boolean;
  oauth_token_expired: boolean;
  config: Record<string, any>;
  // Usage stats
  request_count: number;
  token_count: number;
  error_count: number;
  last_error?: string;
  last_error_at?: string;
  // Metadata
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface EmbeddingProvider {
  id: string;
  name: 'gemini' | 'openai';
  enabled: boolean;
  priority: number;
  auth_type: 'api_key';
  has_api_key: boolean;
  has_oauth_token: boolean;
  oauth_token_expired: boolean;
  config: Record<string, any>;
  // Usage stats
  request_count: number;
  token_count: number;
  error_count: number;
  last_error?: string;
  last_error_at?: string;
  // Metadata
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface LLMProviderCreateRequest {
  name: 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'claudecode';
  enabled?: boolean;
  priority?: number;
  auth_type?: 'api_key' | 'oauth';
  api_key?: string;
  config?: Record<string, any>;
}

export interface EmbeddingProviderCreateRequest {
  name: 'gemini' | 'openai';
  enabled?: boolean;
  priority?: number;
  auth_type?: 'api_key';
  api_key?: string;
  config?: Record<string, any>;
}

// Claude Code Provider
export interface ClaudeCodeStatus {
  detected: boolean;
  info?: {
    subscription_type: 'max' | 'pro' | 'free';
    is_expired: boolean;
    has_token: boolean;
    organization_id?: string;
  };
  provider_exists: boolean;
  provider_id?: string;
}

export interface ClaudeCodeImportRequest {
  access_token: string;
  refresh_token?: string;
  subscription_type: 'max' | 'pro' | 'free';
}

export interface BootstrapRequest {
  token: string;
  email: string;
  name: string;
}

export interface BootstrapResponse {
  user_id: string;
  api_token: string;
  message: string;
}

// API Token types
export interface ApiTokenInfo {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface CreateTokenRequest {
  name: string;
  scopes?: string[];
  expires_in_days?: number;
}

export interface CreateTokenResponse {
  id: string;
  name: string;
  token: string;
  token_prefix: string;
  created_at: string;
  expires_at: string | null;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface SearchResult {
  memory: Memory;
  content?: string;
  similarity: number;
  // Enhanced decay scoring fields
  score?: number;          // Raw semantic similarity (0.0-1.0)
  strength?: number;       // Recency/access-based strength (0.0-1.0)
  combined_score?: number; // Final blended score used for ranking
  is_neighbour?: boolean;  // True if found via link traversal
}

export interface SearchOptions {
  source?: MemorySource;
  limit?: number;
  include_context?: boolean;
  // Decay override options
  strength_weight?: number;      // Override project default (0.0-1.0)
  decay_half_life_days?: number; // Override project default (min 1.0)
}

// Internal types for raw API responses
interface RawJob {
  id: string;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retry' | 'cancelled';
  project_id?: string;
  repository_id?: string;
  total_items?: number;
  processed_items?: number;
  failed_items?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: string;
  error?: string;
  priority?: number;
  retry_count?: number;
  max_retries?: number;
}

interface JobsResponse {
  jobs: RawJob[];
  total: number;
  offset: number;
  limit: number;
}

// API Client Class
class FoldApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('fold_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('fold_token', token);
    } else {
      localStorage.removeItem('fold_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async _fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        code: 'UNKNOWN',
        message: response.statusText,
      }));
      throw new Error(error.message || 'API request failed');
    }

    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text) as T;
  }

  // Public request method for generic API calls
  async request<T = any>(method: string, endpoint: string, body?: any): Promise<T> {
    const options: RequestInit = {
      method,
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    return this._fetch<T>(endpoint, options);
  }

  // Public endpoints
  async getStatus(): Promise<SystemStatus> {
    return this._fetch<SystemStatus>('/status');
  }

  async getJobs(limit = 20, offset = 0): Promise<JobsResponse> {
    return this._fetch<JobsResponse>(`/status/jobs?limit=${limit}&offset=${offset}`);
  }

  async getAuthProviders(): Promise<{ providers: AuthProvider[] }> {
    return this._fetch<{ providers: AuthProvider[] }>('/auth/providers');
  }

  async bootstrap(data: BootstrapRequest): Promise<BootstrapResponse> {
    return this._fetch<BootstrapResponse>('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Protected endpoints
  async getProjects(): Promise<{ projects: Project[]; total: number }> {
    return this._fetch<{ projects: Project[]; total: number }>('/projects');
  }

  async getProject(id: string): Promise<Project> {
    return this._fetch<Project>(`/projects/${id}`);
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    return this._fetch<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<void> {
    return this._fetch<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    return this._fetch<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Algorithm Configuration
  async getAlgorithmConfig(projectId: string): Promise<AlgorithmConfig> {
    return this._fetch<AlgorithmConfig>(`/projects/${projectId}/config/algorithm`);
  }

  async updateAlgorithmConfig(projectId: string, config: Partial<AlgorithmConfig>): Promise<AlgorithmConfig> {
    return this._fetch<AlgorithmConfig>(`/projects/${projectId}/config/algorithm`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async listRepositories(projectId: string): Promise<Repository[]> {
    const result = await this.request<{ repositories: Repository[] } | Repository[]>('GET', `/projects/${projectId}/repositories`);
    // Handle both array and object response formats
    return Array.isArray(result) ? result : (result.repositories || []);
  }

  async getRepository(projectId: string, repoId: string): Promise<Repository> {
    return this._fetch<Repository>(`/projects/${projectId}/repositories/${repoId}`);
  }

  async createRepository(projectId: string, data: RepositoryCreateRequest): Promise<Repository> {
    return this._fetch<Repository>(`/projects/${projectId}/repositories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteRepository(projectId: string, repoId: string): Promise<void> {
    return this._fetch<void>(`/projects/${projectId}/repositories/${repoId}`, {
      method: 'DELETE',
    });
  }

  async reindexRepository(projectId: string, repoId: string): Promise<void> {
    return this._fetch<void>(`/projects/${projectId}/repositories/${repoId}/reindex`, {
      method: 'POST',
    });
  }

  async syncRepository(projectId: string, repoId: string): Promise<void> {
    return this._fetch<void>(`/projects/${projectId}/repositories/${repoId}/sync`, {
      method: 'POST',
    });
  }

  async updateRepository(projectId: string, repoId: string, data: RepositoryUpdateRequest): Promise<Repository> {
    return this._fetch<Repository>(`/projects/${projectId}/repositories/${repoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getMemories(
    projectId: string,
    params: { source?: string; limit?: number; offset?: number } = {}
  ): Promise<{ memories: Memory[]; total: number }> {
    const query = new URLSearchParams();
    if (params.source) query.set('source', params.source);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    return this._fetch<{ memories: Memory[]; total: number }>(
      `/projects/${projectId}/memories?${query}`
    );
  }

  async getMemoryContext(
    projectId: string,
    memoryId: string,
    depth: number = 2
  ): Promise<MemoryContext> {
    return this._fetch<MemoryContext>(
      `/projects/${projectId}/context/${memoryId}?depth=${depth}`
    );
  }

  async searchMemories(
    projectId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: Array<Memory & { score: number; strength?: number; combined_score?: number; content?: string }> }> {
    const body: Record<string, any> = {
      query,
      limit: options.limit || 10,
    };
    // Add source filter if provided
    if (options.source) {
      body.source = options.source;
    }
    if (options.include_context) {
      body.include_context = true;
    }
    // Add decay overrides if provided
    if (options.strength_weight !== undefined) {
      body.strength_weight = options.strength_weight;
    }
    if (options.decay_half_life_days !== undefined) {
      body.decay_half_life_days = options.decay_half_life_days;
    }

    return this._fetch<{ results: Array<Memory & { score: number; strength?: number; combined_score?: number; content?: string }> }>(
      `/projects/${projectId}/search`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  async createMemory(projectId: string, data: Partial<Memory>): Promise<Memory> {
    return this._fetch<Memory>(`/projects/${projectId}/memories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMemory(projectId: string, memoryId: string): Promise<void> {
    return this._fetch<void>(`/projects/${projectId}/memories/${memoryId}`, {
      method: 'DELETE',
    });
  }

  async updateMemory(projectId: string, memoryId: string, data: {
    title?: string;
    content?: string;
    author?: string;
    tags?: string[];
    file_path?: string;
  }): Promise<Memory> {
    return this._fetch<Memory>(`/projects/${projectId}/memories/${memoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getMe(): Promise<{
    id: string;
    email: string;
    name: string;
    roles: string[];
  }> {
    return this._fetch('/auth/me');
  }

  // LLM Providers
  async listLLMProviders(): Promise<LLMProvider[]> {
    return this._fetch<LLMProvider[]>('/providers/llm');
  }

  async createLLMProvider(data: LLMProviderCreateRequest): Promise<LLMProvider> {
    return this._fetch<LLMProvider>('/providers/llm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLLMProvider(id: string, data: Partial<LLMProviderCreateRequest>): Promise<LLMProvider> {
    return this._fetch<LLMProvider>(`/providers/llm/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLLMProvider(id: string): Promise<void> {
    return this._fetch<void>(`/providers/llm/${id}`, {
      method: 'DELETE',
    });
  }

  async testLLMProvider(id: string): Promise<{
    success: boolean;
    message: string;
    latency_ms?: number;
    model?: string;
    response_preview?: string;
    error_code?: string;
    error_details?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  }> {
    return this._fetch(`/providers/llm/${id}/test`, {
      method: 'POST',
    });
  }

  // OAuth for providers - redirects to authorization URL
  getProviderOAuthUrl(providerType: 'llm' | 'embedding', providerName: 'anthropic', mode: 'console' | 'max' = 'console'): string {
    return `${API_BASE}/providers/${providerType}/${providerName}/oauth/authorize?mode=${mode}`;
  }

  // Claude Code Provider
  async getClaudeCodeStatus(): Promise<ClaudeCodeStatus> {
    return this._fetch<ClaudeCodeStatus>('/providers/llm/claudecode/status');
  }

  async autoImportClaudeCode(): Promise<LLMProvider> {
    return this._fetch<LLMProvider>('/providers/llm/claudecode/auto-import', {
      method: 'POST',
    });
  }

  async importClaudeCode(data: ClaudeCodeImportRequest): Promise<LLMProvider> {
    return this._fetch<LLMProvider>('/providers/llm/claudecode/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Embedding Providers
  async listEmbeddingProviders(): Promise<EmbeddingProvider[]> {
    return this._fetch<EmbeddingProvider[]>('/providers/embedding');
  }

  async createEmbeddingProvider(data: EmbeddingProviderCreateRequest): Promise<EmbeddingProvider> {
    return this._fetch<EmbeddingProvider>('/providers/embedding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmbeddingProvider(id: string, data: Partial<EmbeddingProviderCreateRequest>): Promise<EmbeddingProvider> {
    return this._fetch<EmbeddingProvider>(`/providers/embedding/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmbeddingProvider(id: string): Promise<void> {
    return this._fetch<void>(`/providers/embedding/${id}`, {
      method: 'DELETE',
    });
  }

  async testEmbeddingProvider(id: string): Promise<{
    success: boolean;
    message: string;
    latency_ms?: number;
    model?: string;
    response_preview?: string;
    error_code?: string;
    error_details?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  }> {
    return this._fetch(`/providers/embedding/${id}/test`, {
      method: 'POST',
    });
  }

  // Repository commits and PRs
  async listRepositoryCommits(
    projectId: string,
    repoId: string,
    params: { branch?: string; page?: number; per_page?: number } = {}
  ): Promise<{
    commits: Array<{
      sha: string;
      message: string;
      author_name: string;
      author_email: string;
      committed_at: string;
      url: string;
    }>;
    page: number;
    per_page: number;
    has_more: boolean;
  }> {
    const query = new URLSearchParams();
    if (params.branch) query.set('branch', params.branch);
    if (params.page) query.set('page', String(params.page));
    if (params.per_page) query.set('per_page', String(params.per_page));
    return this._fetch(`/projects/${projectId}/repositories/${repoId}/commits?${query}`);
  }

  async listRepositoryPullRequests(
    projectId: string,
    repoId: string,
    params: { state?: 'open' | 'closed' | 'merged' | 'all'; page?: number; per_page?: number } = {}
  ): Promise<{
    pull_requests: Array<{
      number: number;
      title: string;
      state: 'open' | 'closed' | 'merged';
      author: string;
      head_branch: string;
      base_branch: string;
      created_at: string;
      updated_at: string;
      merged_at?: string;
      url: string;
    }>;
    page: number;
    per_page: number;
    has_more: boolean;
  }> {
    const query = new URLSearchParams();
    if (params.state) query.set('state', params.state);
    if (params.page) query.set('page', String(params.page));
    if (params.per_page) query.set('per_page', String(params.per_page));
    return this._fetch(`/projects/${projectId}/repositories/${repoId}/pulls?${query}`);
  }

  // File source providers
  async listFileSourceProviders(): Promise<{
    providers: Array<{
      provider_type: string;
      display_name: string;
      supports_webhooks: boolean;
      requires_polling: boolean;
      available: boolean;
    }>;
  }> {
    return this._fetch('/file-sources/providers');
  }

  // Jobs (at /status/jobs)
  async listJobsFiltered(
    params: { status?: string; job_type?: string; limit?: number; offset?: number } = {}
  ): Promise<JobsResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.job_type) query.set('job_type', params.job_type);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return this._fetch<JobsResponse>(`/status/jobs?${query}`);
  }

  async getJobById(jobId: string): Promise<RawJob> {
    return this._fetch<RawJob>(`/status/jobs/${jobId}`);
  }

  async getJobLogs(jobId: string, params: { level?: string; limit?: number } = {}): Promise<{
    job_id: string;
    logs: JobLog[];
    total: number;
  }> {
    const query = new URLSearchParams();
    if (params.level) query.set('level', params.level);
    if (params.limit) query.set('limit', String(params.limit));
    return this._fetch(`/status/jobs/${jobId}/logs?${query}`);
  }

  // Auth logout
  async logout(): Promise<void> {
    return this._fetch('/auth/logout', {
      method: 'POST',
    });
  }

  // API Token management
  async listApiTokens(): Promise<{ tokens: ApiTokenInfo[] }> {
    return this._fetch<{ tokens: ApiTokenInfo[] }>('/auth/tokens');
  }

  async createApiToken(data: CreateTokenRequest): Promise<CreateTokenResponse> {
    return this._fetch<CreateTokenResponse>('/auth/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeApiToken(tokenId: string): Promise<void> {
    return this._fetch<void>(`/auth/tokens/${tokenId}`, {
      method: 'DELETE',
    });
  }

  // Admin token management (admin only)
  async listUserApiTokens(userId: string): Promise<{ tokens: ApiTokenInfo[] }> {
    return this._fetch<{ tokens: ApiTokenInfo[] }>(`/auth/admin/users/${userId}/tokens`);
  }

  async revokeUserApiToken(userId: string, tokenId: string): Promise<void> {
    return this._fetch<void>(`/auth/admin/users/${userId}/tokens/${tokenId}`, {
      method: 'DELETE',
    });
  }

  async createUserApiToken(
    userId: string,
    name: string,
    expiresInDays?: number
  ): Promise<{ id: string; name: string; token: string; token_prefix: string; created_at: string; expires_at?: string }> {
    return this._fetch<any>('/auth/tokens', {
      method: 'POST',
      body: JSON.stringify({
        name,
        expires_in_days: expiresInDays,
        user_id: userId,
      }),
    });
  }
}

const apiClient = new FoldApiClient();

// Facade API for components
export const api = {
  // Auth
  setToken: (token: string | null) => apiClient.setToken(token),
  getToken: () => apiClient.getToken(),
  getMe: () => apiClient.getMe(),
  bootstrap: (data: BootstrapRequest) => apiClient.bootstrap(data),
  getAuthProviders: () => apiClient.getAuthProviders(),

  // Status
  getStatus: () => apiClient.getStatus(),
  getJobs: async (): Promise<Job[]> => {
    const result = await apiClient.getJobs(100, 0);
    return result.jobs.map((j: RawJob): Job => ({
      id: j.id,
      type: j.job_type,
      status: j.status,
      project_id: j.project_id,
      progress: j.total_items && j.processed_items !== undefined
        ? j.processed_items / j.total_items
        : undefined,
      created_at: j.created_at,
      started_at: j.started_at,
      completed_at: j.completed_at,
      error: j.error,
    }));
  },

  // Projects
  listProjects: async (): Promise<Project[]> => {
    const result = await apiClient.getProjects();
    return result.projects;
  },
  getProject: (id: string) => apiClient.getProject(id),
  createProject: (data: Partial<Project>) => apiClient.createProject(data),
  updateProject: (id: string, data: Partial<Project>) => apiClient.updateProject(id, data),
  deleteProject: (id: string) => apiClient.deleteProject(id),

  // Algorithm Configuration
  getAlgorithmConfig: (projectId: string) => apiClient.getAlgorithmConfig(projectId),
  updateAlgorithmConfig: (projectId: string, config: Partial<AlgorithmConfig>) =>
    apiClient.updateAlgorithmConfig(projectId, config),

  // Repositories
  listRepositories: (projectId: string) => apiClient.listRepositories(projectId),
  getRepository: (projectId: string, repoId: string) => apiClient.getRepository(projectId, repoId),
  createRepository: (projectId: string, data: RepositoryCreateRequest) =>
    apiClient.createRepository(projectId, data),
  deleteRepository: (projectId: string, repoId: string) => apiClient.deleteRepository(projectId, repoId),
  reindexRepository: (projectId: string, repoId: string) => apiClient.reindexRepository(projectId, repoId),
  syncRepository: (projectId: string, repoId: string) => apiClient.syncRepository(projectId, repoId),
  updateRepository: (projectId: string, repoId: string, data: RepositoryUpdateRequest) =>
    apiClient.updateRepository(projectId, repoId, data),

  // Memories
  listMemories: async (
    projectId: string,
    params: { source?: string; limit?: number; offset?: number } = {}
  ) => {
    return apiClient.getMemories(projectId, params);
  },
  createMemory: (projectId: string, data: Partial<Memory>) =>
    apiClient.createMemory(projectId, data),
  deleteMemory: (projectId: string, memoryId: string) =>
    apiClient.deleteMemory(projectId, memoryId),
  updateMemory: (projectId: string, memoryId: string, data: {
    title?: string;
    content?: string;
    author?: string;
    tags?: string[];
    file_path?: string;
  }) => apiClient.updateMemory(projectId, memoryId, data),
  getMemoryContext: (projectId: string, memoryId: string, depth?: number) =>
    apiClient.getMemoryContext(projectId, memoryId, depth),

  // Search
  searchMemories: async (
    projectId: string,
    query: string,
    options: {
      source?: MemorySource;
      limit?: number;
      include_context?: boolean;
      strength_weight?: number;
      decay_half_life_days?: number;
    } = {}
  ): Promise<{ results: SearchResult[] }> => {
    const result = await apiClient.searchMemories(projectId, query, {
      source: options.source,
      limit: options.limit,
      include_context: options.include_context,
      strength_weight: options.strength_weight,
      decay_half_life_days: options.decay_half_life_days,
    });
    return {
      results: result.results.map((r): SearchResult => ({
        memory: r,
        content: r.content,
        similarity: r.score,
        score: r.score,
        strength: r.strength,
        combined_score: r.combined_score,
      })),
    };
  },

  // LLM Providers
  listLLMProviders: () => apiClient.listLLMProviders(),
  createLLMProvider: (data: LLMProviderCreateRequest) => apiClient.createLLMProvider(data),
  updateLLMProvider: (id: string, data: Partial<LLMProviderCreateRequest>) => apiClient.updateLLMProvider(id, data),
  deleteLLMProvider: (id: string) => apiClient.deleteLLMProvider(id),
  testLLMProvider: (id: string) => apiClient.testLLMProvider(id),
  getProviderOAuthUrl: (providerType: 'llm' | 'embedding', providerName: 'anthropic', mode?: 'console' | 'max') =>
    apiClient.getProviderOAuthUrl(providerType, providerName, mode),

  // Claude Code Provider
  getClaudeCodeStatus: () => apiClient.getClaudeCodeStatus(),
  autoImportClaudeCode: () => apiClient.autoImportClaudeCode(),
  importClaudeCode: (data: ClaudeCodeImportRequest) => apiClient.importClaudeCode(data),

  // Embedding Providers
  listEmbeddingProviders: () => apiClient.listEmbeddingProviders(),
  createEmbeddingProvider: (data: EmbeddingProviderCreateRequest) => apiClient.createEmbeddingProvider(data),
  updateEmbeddingProvider: (id: string, data: Partial<EmbeddingProviderCreateRequest>) => apiClient.updateEmbeddingProvider(id, data),
  deleteEmbeddingProvider: (id: string) => apiClient.deleteEmbeddingProvider(id),
  testEmbeddingProvider: (id: string) => apiClient.testEmbeddingProvider(id),

  // Repository commits/PRs
  listRepositoryCommits: (projectId: string, repoId: string, params?: any) =>
    apiClient.listRepositoryCommits(projectId, repoId, params),
  listRepositoryPullRequests: (projectId: string, repoId: string, params?: any) =>
    apiClient.listRepositoryPullRequests(projectId, repoId, params),

  // File sources
  listFileSourceProviders: () => apiClient.listFileSourceProviders(),

  // Jobs
  listJobsFiltered: async (
    params: { status?: string; job_type?: string; limit?: number; offset?: number } = {}
  ): Promise<Job[]> => {
    const result = await apiClient.listJobsFiltered(params);
    return result.jobs.map((j: RawJob): Job => ({
      id: j.id,
      type: j.job_type,
      status: j.status,
      project_id: j.project_id,
      repository_id: j.repository_id,
      priority: j.priority,
      processed_items: j.processed_items,
      total_items: j.total_items,
      progress: j.total_items && j.processed_items !== undefined
        ? j.processed_items / j.total_items
        : undefined,
      created_at: j.created_at,
      started_at: j.started_at,
      completed_at: j.completed_at,
      error: j.error,
    }));
  },
  listJobsFilteredWithMeta: async (
    params: { status?: string; job_type?: string; limit?: number; offset?: number } = {}
  ): Promise<{ jobs: Job[]; total: number; offset: number; limit: number }> => {
    const result = await apiClient.listJobsFiltered(params);
    return {
      jobs: result.jobs.map((j: RawJob): Job => ({
        id: j.id,
        type: j.job_type,
        status: j.status,
        project_id: j.project_id,
        repository_id: j.repository_id,
        priority: j.priority,
        processed_items: j.processed_items,
        total_items: j.total_items,
        progress: j.total_items && j.processed_items !== undefined
          ? j.processed_items / j.total_items
          : undefined,
        created_at: j.created_at,
        started_at: j.started_at,
        completed_at: j.completed_at,
        error: j.error,
      })),
      total: result.total,
      offset: result.offset,
      limit: result.limit,
    };
  },
  getJobById: async (jobId: string): Promise<Job> => {
    const j = await apiClient.getJobById(jobId);
    return {
      id: j.id,
      type: j.job_type,
      status: j.status,
      project_id: j.project_id,
      repository_id: j.repository_id,
      priority: j.priority,
      processed_items: j.processed_items,
      total_items: j.total_items,
      progress: j.total_items && j.processed_items !== undefined
        ? j.processed_items / j.total_items
        : undefined,
      created_at: j.created_at,
      started_at: j.started_at,
      completed_at: j.completed_at,
      error: j.error,
    };
  },
  getJobLogs: (jobId: string, params?: { level?: string; limit?: number }) =>
    apiClient.getJobLogs(jobId, params),

  // Auth
  logout: () => apiClient.logout(),

  // API Token management
  listApiTokens: () => apiClient.listApiTokens(),
  createApiToken: (data: CreateTokenRequest) => apiClient.createApiToken(data),
  revokeApiToken: (tokenId: string) => apiClient.revokeApiToken(tokenId),

  // Admin token management (admin only)
  listUserApiTokens: (userId: string) => apiClient.listUserApiTokens(userId),
  createUserApiToken: (userId: string, name: string, expiresInDays?: number) =>
    apiClient.createUserApiToken(userId, name, expiresInDays),
  revokeUserApiToken: (userId: string, tokenId: string) => apiClient.revokeUserApiToken(userId, tokenId),

  // User management (admin only)
  listUsers: async () => apiClient.request('GET', '/users'),
  getUser: (id: string) => apiClient.request('GET', `/users/${id}`),
  createUser: (data: any) => apiClient.request('POST', '/users', data),
  updateUser: (id: string, data: any) => apiClient.request('PATCH', `/users/${id}`, data),
  deleteUser: (id: string) => apiClient.request('DELETE', `/users/${id}`),

  // Group management
  listGroups: async () => apiClient.request('GET', '/groups'),
  getGroup: (id: string) => apiClient.request('GET', `/groups/${id}`),
  createGroup: (data: any) => apiClient.request('POST', '/groups', data),
  updateGroup: (id: string, data: any) => apiClient.request('PATCH', `/groups/${id}`, data),
  deleteGroup: (id: string) => apiClient.request('DELETE', `/groups/${id}`),
  listGroupMembers: (id: string) => apiClient.request('GET', `/groups/${id}/members`),
  addGroupMember: (groupId: string, userId: string) =>
    apiClient.request('POST', `/groups/${groupId}/members`, { user_id: userId }),
  removeGroupMember: (groupId: string, userId: string) =>
    apiClient.request('DELETE', `/groups/${groupId}/members/${userId}`),

  // Project Members
  listProjectMembers: (projectId: string) =>
    apiClient.request('GET', `/projects/${projectId}/members`),
  addProjectMember: (projectId: string, userId: string, role: string) =>
    apiClient.request('POST', `/projects/${projectId}/members`, {
      user_id: userId,
      role,
    }),
  removeProjectMember: (projectId: string, userId: string) =>
    apiClient.request('DELETE', `/projects/${projectId}/members/${userId}`),
  updateProjectMemberRole: (projectId: string, userId: string, role: string) =>
    apiClient.request('PATCH', `/projects/${projectId}/members/${userId}`, {
      role,
    }),
};
