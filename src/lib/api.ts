// Fold API Client

// Runtime config (injected by docker-entrypoint.sh via /config.js) takes priority,
// then Vite build-time env var, then empty string for same-origin requests.
const _win = globalThis as unknown as { __FOLD_CONFIG__?: { apiUrl?: string } };
export const API_BASE = _win.__FOLD_CONFIG__?.apiUrl ?? import.meta.env.VITE_API_URL ?? '';

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

export interface JobStatusCounts {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  paused: number;
  retry: number;
}

export interface Job {
  id: string;
  type: 'index_repo' | 'reindex_repo' | 'sync_metadata' | 'index_history' | string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retry' | 'cancelled' | 'paused';
  project_id?: string;
  project_name?: string;
  priority?: number;
  processed_items?: number;
  total_items?: number;
  failed_items?: number;
  progress?: number;
  retry_count?: number;
  max_retries?: number;
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
  /** Provider type: 'local', 'github', or 'gitlab' */
  provider: string;
  /** Local path where the project root (and fold/) lives */
  root_path: string;
  /** Remote repository owner (for github/gitlab) */
  remote_owner?: string;
  /** Remote repository name (for github/gitlab) */
  remote_repo?: string;
  /** Remote branch (for github/gitlab) */
  remote_branch?: string;
  /** Author patterns to ignore during webhook processing */
  ignored_commit_authors?: string[];
  /** Whether a webhook is registered on the remote provider */
  webhook_registered?: boolean;
  /** Optional group label for organizing projects */
  project_group?: string;
  memory_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  slug: string;
  name: string;
  description?: string;
  provider: string;
  root_path?: string;
  remote_owner?: string;
  remote_repo?: string;
  remote_branch?: string;
  access_token?: string;
  connected_account_id?: string;
  project_group?: string;
}

export interface ConnectedAccount {
  id: string;
  provider: string;
  username: string;
  scopes: string | null;
  token_expires_at: string | null;
  installation_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  html_url: string;
  clone_url: string;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface AlgorithmConfig {
  strength_weight: number;       // 0.0-1.0, default 0.3
  decay_half_life_days: number;  // min 1.0, default 30.0
}

// Project Status Types
export interface ProjectStatus {
  project: {
    id: string;
    slug: string;
    name: string;
    description?: string;
    provider: string;
    root_path?: string;
    remote_owner?: string;
    remote_repo?: string;
    remote_branch?: string;
  };
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    accessible: boolean;
    vector_collection_exists: boolean;
    has_recent_failures: boolean;
    indexing_in_progress: boolean;
    issues: string[];
  };
  database: {
    total_memories: number;
    memories_by_type: {
      codebase: number;
      session: number;
      decision: number;
      spec: number;
      commit: number;
      pr: number;
      task: number;
      general: number;
    };
    memories_by_source: {
      file: number;
      agent: number;
      git: number;
    };
    total_chunks: number;
    total_links: number;
    total_attachments: number;
    estimated_size_bytes: number;
  };
  vector_db: {
    collection_name: string;
    exists: boolean;
    total_vectors: number;
    memory_vectors: number;
    chunk_vectors: number;
    dimension: number;
    sync_status: {
      expected_count: number;
      vector_count: number;
      in_sync: boolean;
      difference: number;
    };
  };
  jobs: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    paused: number;
    completed_24h: number;
    failed_24h: number;
    by_type: {
      index_repo: number;
      reindex_repo: number;
      index_history: number;
      sync_metadata: number;
      process_webhook: number;
      generate_summary: number;
      custom: number;
    };
  };
  recent_jobs: Array<{
    id: string;
    job_type: string;
    status: string;
    progress?: number;
    created_at: string;
    completed_at?: string;
    error?: string;
  }>;
  filesystem?: {
    root_exists: boolean;
    fold_dir_exists: boolean;
    indexable_files_estimate: number;
    indexed_files_count: number;
    fold_dir_size_bytes: number;
  };
  indexing: {
    in_progress: boolean;
    current_job_id?: string;
    progress?: number;
    last_indexed_at?: string;
    last_duration_secs?: number;
  };
  timestamps: {
    created_at: string;
    updated_at: string;
    last_indexed_at?: string;
    last_job_completed_at?: string;
    last_job_failed_at?: string;
    last_memory_created_at?: string;
  };
}

// Repository types removed - projects now directly include repository info via provider field

export type MemorySource = 'file' | 'manual' | 'generated';

export interface Memory {
  id: string;
  project_id: string;

  // Content reference (actual content in fold/)
  content_hash?: string;
  hash_prefix?: string;

  // Content (included in list response)
  content?: string;

  // Source tracking
  source: MemorySource;
  file_path?: string;
  language?: string;

  // Line range within source file (for chunk memories)
  line_start?: number;
  line_end?: number;

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
  memory: Memory & { content?: string };
  related: Array<{ id: string; title?: string; content_preview: string; link_type: string; link_context?: string }>;
  similar: Array<{ id: string; title?: string; content_preview: string; score: number }>;
}

export interface FlushResult {
  deleted_memories: number;
  matched_files: string[];
  matched_file_count: number;
  dry_run: boolean;
}

export interface AuthProvider {
  id: string;
  display_name: string;
  icon?: string;
  type: string;
  client_id?: string;
  app_slug?: string;
}

export interface LLMProvider {
  id: string;
  name: 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'openai_compat';
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
  name: 'gemini' | 'openai' | 'ollama' | 'openrouter';
  enabled: boolean;
  priority: number;
  search_priority?: number;
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
  name: 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'openai_compat';
  enabled?: boolean;
  priority?: number;
  auth_type?: 'api_key' | 'oauth';
  api_key?: string;
  config?: Record<string, any>;
}

export interface EmbeddingProviderCreateRequest {
  name: 'gemini' | 'openai' | 'ollama' | 'openrouter';
  enabled?: boolean;
  priority?: number;
  search_priority?: number;
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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retry' | 'cancelled' | 'paused';
  project_id?: string;
  project_name?: string;
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
  counts: JobStatusCounts;
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
  async getProjects(params?: { limit?: number; offset?: number; group?: string }): Promise<{ projects: Project[]; total: number; offset: number; limit: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.group) searchParams.set('group', params.group);
    const qs = searchParams.toString();
    return this._fetch<{ projects: Project[]; total: number; offset: number; limit: number }>(`/projects${qs ? '?' + qs : ''}`);
  }

  async getProjectGroups(): Promise<{ groups: string[] }> {
    return this._fetch<{ groups: string[] }>('/projects/groups');
  }

  async getProject(id: string): Promise<Project> {
    return this._fetch<Project>(`/projects/${id}`);
  }

  async getProjectStatus(id: string): Promise<ProjectStatus> {
    return this._fetch<ProjectStatus>(`/projects/${id}/status`);
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
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

  // Repository methods removed - projects now include repository info directly

  /** Trigger a reindex of the project's codebase */
  async reindexProject(projectId: string): Promise<void> {
    return this._fetch<void>(`/projects/${projectId}/reindex`, {
      method: 'POST',
    });
  }

  /** Trigger a sync of the project's metadata from remote */
  async syncProject(projectId: string): Promise<void> {
    return this._fetch<void>(`/projects/${projectId}/sync`, {
      method: 'POST',
    });
  }

  /** Trigger a sync of git commits as memories */
  async syncCommits(projectId: string, limit?: number): Promise<void> {
    const query = limit ? `?limit=${limit}` : '';
    return this._fetch<void>(`/projects/${projectId}/sync-commits${query}`, {
      method: 'POST',
    });
  }

  async getMemories(
    projectId: string,
    params: {
      source?: string;
      tag?: string;
      tags?: string[];
      created_after?: string;
      created_before?: string;
      updated_after?: string;
      updated_before?: string;
      sort_by?: 'created_at' | 'updated_at' | 'title';
      sort_dir?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ memories: Memory[]; total: number }> {
    const query = new URLSearchParams();
    if (params.source) query.set('source', params.source);
    // Support both single tag and multiple tags
    if (params.tags && params.tags.length > 0) {
      // Send as comma-separated for backend compatibility
      query.set('tags', params.tags.join(','));
    } else if (params.tag) {
      query.set('tag', params.tag);
    }
    // Date filters
    if (params.created_after) query.set('created_after', params.created_after);
    if (params.created_before) query.set('created_before', params.created_before);
    if (params.updated_after) query.set('updated_after', params.updated_after);
    if (params.updated_before) query.set('updated_before', params.updated_before);
    // Sorting
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_dir) query.set('sort_dir', params.sort_dir);
    // Pagination
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
      `/projects/${projectId}/memories/context/${memoryId}?depth=${depth}`
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

  async flushMemories(projectId: string, pattern: string, dryRun: boolean = false): Promise<FlushResult> {
    return this._fetch<FlushResult>(`/projects/${projectId}/memories/flush`, {
      method: 'POST',
      body: JSON.stringify({ pattern, dry_run: dryRun }),
    });
  }

  /**
   * Download the original source file for a memory.
   * Returns a Blob that can be used to create a download link.
   */
  async downloadSourceFile(projectId: string, memoryId: string): Promise<{ blob: Blob; filename: string }> {
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/projects/${projectId}/memories/${memoryId}/source`, {
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || 'Failed to download source file');
    }

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'source';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    return { blob, filename };
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

  // Webhook management
  async getWebhookStatus(projectId: string): Promise<{
    registered: boolean;
    webhook_id?: string;
    webhook_url: string;
    verified?: boolean;
    events?: string[];
  }> {
    return this._fetch(`/projects/${projectId}/webhook`);
  }

  async createWebhook(projectId: string): Promise<{
    registered: boolean;
    webhook_id: string;
    webhook_url: string;
  }> {
    return this._fetch(`/projects/${projectId}/webhook`, { method: 'POST' });
  }

  async deleteWebhook(projectId: string): Promise<{ deleted: boolean }> {
    return this._fetch(`/projects/${projectId}/webhook`, { method: 'DELETE' });
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

  async cancelJob(jobId: string): Promise<RawJob> {
    return this._fetch<RawJob>(`/status/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  // Connected accounts
  async getConnections(): Promise<{ connections: ConnectedAccount[] }> {
    return this._fetch<{ connections: ConnectedAccount[] }>('/auth/connections');
  }

  async deleteConnection(connectionId: string): Promise<void> {
    return this._fetch<void>(`/auth/connections/${connectionId}`, {
      method: 'DELETE',
    });
  }

  async getConnectionRepos(connectionId: string, params: { search?: string; page?: number; per_page?: number } = {}): Promise<{ repos: GitHubRepo[]; page: number; per_page: number }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.per_page) query.set('per_page', String(params.per_page));
    return this._fetch(`/auth/connections/${connectionId}/repos?${query}`);
  }

  async getConnectionRepoBranches(connectionId: string, owner: string, repo: string): Promise<{ branches: GitHubBranch[] }> {
    return this._fetch(`/auth/connections/${connectionId}/repos/${owner}/${repo}/branches`);
  }

  async getProjectBranches(projectId: string): Promise<{ branches: GitHubBranch[] }> {
    return this._fetch(`/projects/${projectId}/branches`);
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
  listProjects: async (params?: { limit?: number; offset?: number; group?: string }): Promise<{ projects: Project[]; total: number }> => {
    return apiClient.getProjects(params);
  },
  getProjectGroups: () => apiClient.getProjectGroups(),
  getProject: (id: string) => apiClient.getProject(id),
  getProjectStatus: (id: string) => apiClient.getProjectStatus(id),
  createProject: (data: CreateProjectRequest) => apiClient.createProject(data),
  updateProject: (id: string, data: Partial<Project>) => apiClient.updateProject(id, data),
  deleteProject: (id: string) => apiClient.deleteProject(id),

  // Algorithm Configuration
  getAlgorithmConfig: (projectId: string) => apiClient.getAlgorithmConfig(projectId),
  updateAlgorithmConfig: (projectId: string, config: Partial<AlgorithmConfig>) =>
    apiClient.updateAlgorithmConfig(projectId, config),

  // Project actions (reindex, sync)
  reindexProject: (projectId: string) => apiClient.reindexProject(projectId),
  syncProject: (projectId: string) => apiClient.syncProject(projectId),
  syncCommits: (projectId: string, limit?: number) => apiClient.syncCommits(projectId, limit),

  // Memories
  listMemories: async (
    projectId: string,
    params: {
      source?: string;
      tag?: string;
      tags?: string[];
      created_after?: string;
      created_before?: string;
      updated_after?: string;
      updated_before?: string;
      sort_by?: 'created_at' | 'updated_at' | 'title';
      sort_dir?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    } = {}
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
  flushMemories: (projectId: string, pattern: string, dryRun?: boolean) =>
    apiClient.flushMemories(projectId, pattern, dryRun),
  getMemoryContext: (projectId: string, memoryId: string, depth?: number) =>
    apiClient.getMemoryContext(projectId, memoryId, depth),
  downloadSourceFile: (projectId: string, memoryId: string) =>
    apiClient.downloadSourceFile(projectId, memoryId),

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

  // Webhooks
  getWebhookStatus: (projectId: string) => apiClient.getWebhookStatus(projectId),
  createWebhook: (projectId: string) => apiClient.createWebhook(projectId),
  deleteWebhook: (projectId: string) => apiClient.deleteWebhook(projectId),

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
      project_name: j.project_name,
      priority: j.priority,
      processed_items: j.processed_items,
      total_items: j.total_items,
      failed_items: j.failed_items,
      retry_count: j.retry_count,
      max_retries: j.max_retries,
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
  ): Promise<{ jobs: Job[]; total: number; offset: number; limit: number; counts: JobStatusCounts }> => {
    const result = await apiClient.listJobsFiltered(params);
    return {
      jobs: result.jobs.map((j: RawJob): Job => ({
        id: j.id,
        type: j.job_type,
        status: j.status,
        project_id: j.project_id,
        project_name: j.project_name,
        priority: j.priority,
        processed_items: j.processed_items,
        total_items: j.total_items,
        failed_items: j.failed_items,
        retry_count: j.retry_count,
        max_retries: j.max_retries,
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
      counts: result.counts,
    };
  },
  getJobById: async (jobId: string): Promise<Job> => {
    const j = await apiClient.getJobById(jobId);
    return {
      id: j.id,
      type: j.job_type,
      status: j.status,
      project_id: j.project_id,
      project_name: j.project_name,
      priority: j.priority,
      processed_items: j.processed_items,
      total_items: j.total_items,
      failed_items: j.failed_items,
      retry_count: j.retry_count,
      max_retries: j.max_retries,
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
  cancelJob: (jobId: string) => apiClient.cancelJob(jobId),

  // Connected accounts
  getConnections: () => apiClient.getConnections(),
  deleteConnection: (connectionId: string) => apiClient.deleteConnection(connectionId),
  getConnectionRepos: (connectionId: string, params?: { search?: string; page?: number; per_page?: number }) =>
    apiClient.getConnectionRepos(connectionId, params),
  getConnectionRepoBranches: (connectionId: string, owner: string, repo: string) =>
    apiClient.getConnectionRepoBranches(connectionId, owner, repo),
  getProjectBranches: (projectId: string) =>
    apiClient.getProjectBranches(projectId),

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

  // Project Group Members
  listProjectGroupMembers: (projectId: string) =>
    apiClient.request('GET', `/projects/${projectId}/group-members`),
  addProjectGroupMember: (projectId: string, groupId: string, role: string) =>
    apiClient.request('POST', `/projects/${projectId}/group-members`, {
      group_id: groupId,
      role,
    }),
  removeProjectGroupMember: (projectId: string, groupId: string) =>
    apiClient.request('DELETE', `/projects/${projectId}/group-members/${groupId}`),
  updateProjectGroupMemberRole: (projectId: string, groupId: string, role: string) =>
    apiClient.request('PATCH', `/projects/${projectId}/group-members/${groupId}`, {
      role,
    }),
};
