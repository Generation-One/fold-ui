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
  created_at: string;
  updated_at: string;
}

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
    options: { types?: string[]; limit?: number } = {}
  ): Promise<{ results: Array<Memory & { score: number }> }> {
    return this.request<{ results: Array<Memory & { score: number }> }>(
      `/projects/${projectId}/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          query,
          types: options.types || [],
          limit: options.limit || 10,
        }),
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
    options: { type?: string; limit?: number } = {}
  ): Promise<{ results: SearchResult[] }> => {
    const result = await apiClient.searchMemories(projectId, query, {
      types: options.type ? [options.type] : undefined,
      limit: options.limit,
    });
    return {
      results: result.results.map((r): SearchResult => ({
        memory: r,
        similarity: r.score,
      })),
    };
  },

  // Graph
  getGraph: (projectId: string) => apiClient.getGraph(projectId),
};
