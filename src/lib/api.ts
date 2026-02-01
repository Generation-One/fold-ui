// Fold API Client

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8765';

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
  embeddings: {
    model: string;
    loaded: boolean;
    dimension: number;
  };
  jobs: {
    pending: number;
    running: number;
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
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retry' | 'cancelled';
  project_id?: string;
  progress?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description?: string;
  root_path?: string;
  repo_url?: string;
  ignored_commit_authors?: string[];
  created_at: string;
  updated_at: string;
}

export interface AlgorithmConfig {
  strength_weight: number;       // 0.0-1.0, default 0.3
  decay_half_life_days: number;  // min 1.0, default 30.0
  ignored_commit_authors: string[];
}

export interface Repository {
  id: string;
  project_id: string;
  provider: 'git-hub' | 'git-lab';
  owner: string;
  name: string;
  default_branch: string;
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  auto_index: boolean;
  last_indexed_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
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

export interface Memory {
  id: string;
  project_id: string;
  type: 'codebase' | 'session' | 'spec' | 'decision' | 'task' | 'general' | 'commit' | 'pr';
  title?: string;
  content: string;
  file_path?: string;
  author?: string;
  tags?: string[];
  keywords?: string[];
  created_at: string;
  updated_at: string;
}

export interface AuthProvider {
  id: string;
  display_name: string;
  icon?: string;
  type: string;
}

export interface LLMProvider {
  id: string;
  name: 'gemini' | 'openai' | 'anthropic' | 'openrouter';
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
  name: 'gemini' | 'openai' | 'anthropic' | 'openrouter';
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

export interface ApiError {
  code: string;
  message: string;
}

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  content: string;
  created_at: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SearchResult {
  memory: Memory;
  similarity: number;
  // Enhanced decay scoring fields
  score?: number;          // Raw semantic similarity (0.0-1.0)
  strength?: number;       // Recency/access-based strength (0.0-1.0)
  combined_score?: number; // Final blended score used for ranking
}

export interface SearchOptions {
  types?: string[];
  limit?: number;
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

  private async request<T>(
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

  // Public endpoints
  async getStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('/status');
  }

  async getJobs(limit = 20, offset = 0): Promise<JobsResponse> {
    return this.request<JobsResponse>(`/status/jobs?limit=${limit}&offset=${offset}`);
  }

  async getAuthProviders(): Promise<{ providers: AuthProvider[] }> {
    return this.request<{ providers: AuthProvider[] }>('/auth/providers');
  }

  async bootstrap(data: BootstrapRequest): Promise<BootstrapResponse> {
    return this.request<BootstrapResponse>('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Protected endpoints
  async getProjects(): Promise<{ projects: Project[]; total: number }> {
    return this.request<{ projects: Project[]; total: number }>('/projects');
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/projects/${id}`);
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<void> {
    return this.request<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Algorithm Configuration
  async getAlgorithmConfig(projectId: string): Promise<AlgorithmConfig> {
    return this.request<AlgorithmConfig>(`/projects/${projectId}/config/algorithm`);
  }

  async updateAlgorithmConfig(projectId: string, config: Partial<AlgorithmConfig>): Promise<AlgorithmConfig> {
    return this.request<AlgorithmConfig>(`/projects/${projectId}/config/algorithm`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async listRepositories(projectId: string): Promise<Repository[]> {
    const result = await this.request<{ repositories: Repository[] } | Repository[]>(`/projects/${projectId}/repositories`);
    // Handle both array and object response formats
    return Array.isArray(result) ? result : (result.repositories || []);
  }

  async getRepository(projectId: string, repoId: string): Promise<Repository> {
    return this.request<Repository>(`/projects/${projectId}/repositories/${repoId}`);
  }

  async createRepository(projectId: string, data: RepositoryCreateRequest): Promise<Repository> {
    return this.request<Repository>(`/projects/${projectId}/repositories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteRepository(projectId: string, repoId: string): Promise<void> {
    return this.request<void>(`/projects/${projectId}/repositories/${repoId}`, {
      method: 'DELETE',
    });
  }

  async reindexRepository(projectId: string, repoId: string): Promise<void> {
    return this.request<void>(`/projects/${projectId}/repositories/${repoId}/reindex`, {
      method: 'POST',
    });
  }

  async getMemories(
    projectId: string,
    params: { type?: string; limit?: number; offset?: number } = {}
  ): Promise<{ memories: Memory[]; total: number }> {
    const query = new URLSearchParams();
    if (params.type) query.set('type', params.type);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    return this.request<{ memories: Memory[]; total: number }>(
      `/projects/${projectId}/memories?${query}`
    );
  }

  async searchMemories(
    projectId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: Array<Memory & { score: number; strength?: number; combined_score?: number }> }> {
    const body: Record<string, any> = {
      query,
      types: options.types || [],
      limit: options.limit || 10,
    };
    // Add decay overrides if provided
    if (options.strength_weight !== undefined) {
      body.strength_weight = options.strength_weight;
    }
    if (options.decay_half_life_days !== undefined) {
      body.decay_half_life_days = options.decay_half_life_days;
    }

    return this.request<{ results: Array<Memory & { score: number; strength?: number; combined_score?: number }> }>(
      `/projects/${projectId}/search`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  async createMemory(projectId: string, data: Partial<Memory>): Promise<Memory> {
    return this.request<Memory>(`/projects/${projectId}/memories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMemory(projectId: string, memoryId: string): Promise<void> {
    return this.request<void>(`/projects/${projectId}/memories/${memoryId}`, {
      method: 'DELETE',
    });
  }

  async getGraph(projectId: string): Promise<GraphData> {
    return this.request<GraphData>(`/projects/${projectId}/graph`);
  }

  async getMe(): Promise<{
    id: string;
    email: string;
    name: string;
    roles: string[];
  }> {
    return this.request('/auth/me');
  }

  // LLM Providers
  async listLLMProviders(): Promise<LLMProvider[]> {
    return this.request<LLMProvider[]>('/providers/llm');
  }

  async createLLMProvider(data: LLMProviderCreateRequest): Promise<LLMProvider> {
    return this.request<LLMProvider>('/providers/llm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLLMProvider(id: string, data: Partial<LLMProviderCreateRequest>): Promise<LLMProvider> {
    return this.request<LLMProvider>(`/providers/llm/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLLMProvider(id: string): Promise<void> {
    return this.request<void>(`/providers/llm/${id}`, {
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
    return this.request(`/providers/llm/${id}/test`, {
      method: 'POST',
    });
  }

  // OAuth for providers - redirects to authorization URL
  getProviderOAuthUrl(providerType: 'llm' | 'embedding', providerName: 'anthropic', mode: 'console' | 'max' = 'console'): string {
    return `${API_BASE}/providers/${providerType}/${providerName}/oauth/authorize?mode=${mode}`;
  }

  // Embedding Providers
  async listEmbeddingProviders(): Promise<EmbeddingProvider[]> {
    return this.request<EmbeddingProvider[]>('/providers/embedding');
  }

  async createEmbeddingProvider(data: EmbeddingProviderCreateRequest): Promise<EmbeddingProvider> {
    return this.request<EmbeddingProvider>('/providers/embedding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmbeddingProvider(id: string, data: Partial<EmbeddingProviderCreateRequest>): Promise<EmbeddingProvider> {
    return this.request<EmbeddingProvider>(`/providers/embedding/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmbeddingProvider(id: string): Promise<void> {
    return this.request<void>(`/providers/embedding/${id}`, {
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
    return this.request(`/providers/embedding/${id}/test`, {
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
    return this.request(`/projects/${projectId}/repositories/${repoId}/commits?${query}`);
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
    return this.request(`/projects/${projectId}/repositories/${repoId}/pulls?${query}`);
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
    return this.request('/file-sources/providers');
  }

  // Auth logout
  async logout(): Promise<void> {
    return this.request('/auth/logout', {
      method: 'POST',
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

  // Memories
  listMemories: async (
    projectId: string,
    params: { type?: string; limit?: number; offset?: number } = {}
  ) => {
    return apiClient.getMemories(projectId, params);
  },
  createMemory: (projectId: string, data: Partial<Memory>) =>
    apiClient.createMemory(projectId, data),
  deleteMemory: (projectId: string, memoryId: string) =>
    apiClient.deleteMemory(projectId, memoryId),

  // Search
  searchMemories: async (
    projectId: string,
    query: string,
    options: {
      type?: string;
      limit?: number;
      strength_weight?: number;
      decay_half_life_days?: number;
    } = {}
  ): Promise<{ results: SearchResult[] }> => {
    const result = await apiClient.searchMemories(projectId, query, {
      types: options.type ? [options.type] : undefined,
      limit: options.limit,
      strength_weight: options.strength_weight,
      decay_half_life_days: options.decay_half_life_days,
    });
    return {
      results: result.results.map((r): SearchResult => ({
        memory: r,
        similarity: r.score,
        score: r.score,
        strength: r.strength,
        combined_score: r.combined_score,
      })),
    };
  },

  // Graph
  getGraph: (projectId: string) => apiClient.getGraph(projectId),

  // LLM Providers
  listLLMProviders: () => apiClient.listLLMProviders(),
  createLLMProvider: (data: LLMProviderCreateRequest) => apiClient.createLLMProvider(data),
  updateLLMProvider: (id: string, data: Partial<LLMProviderCreateRequest>) => apiClient.updateLLMProvider(id, data),
  deleteLLMProvider: (id: string) => apiClient.deleteLLMProvider(id),
  testLLMProvider: (id: string) => apiClient.testLLMProvider(id),
  getProviderOAuthUrl: (providerType: 'llm' | 'embedding', providerName: 'anthropic', mode?: 'console' | 'max') =>
    apiClient.getProviderOAuthUrl(providerType, providerName, mode),

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

  // Auth
  logout: () => apiClient.logout(),
};
