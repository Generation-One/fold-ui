import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useProject } from '../stores/project';
import type { SearchResult, MemorySource } from '../lib/api';
import { EmptyState, SourceBadge } from '../components/ui';
import { MemoryDetailModal } from '../components/MemoryDetailModal';
import useSWR from 'swr';
import styles from './Search.module.css';

const SOURCE_TYPES: MemorySource[] = ['file', 'manual', 'generated'];
const SOURCE_LABELS: Record<MemorySource, string> = {
  file: 'File',
  manual: 'Manual',
  generated: 'Generated',
};

export function Search() {
  const navigate = useNavigate();
  const { selectedProjectId } = useProject();
  const selectedProject = selectedProjectId;
  const [selectedSource, setSelectedSource] = useState<MemorySource | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Advanced search options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useRecencyBias, setUseRecencyBias] = useState(false);
  const [strengthWeight, setStrengthWeight] = useState(0.3);
  const [decayHalfLife, setDecayHalfLife] = useState(30);
  // Memory detail modal
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Projects are fetched by ProjectSelector, but we warm the cache here
  useSWR('projects', () => api.listProjects());

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !query.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const options: {
        source?: MemorySource;
        limit: number;
        strength_weight?: number;
        decay_half_life_days?: number;
      } = {
        source: selectedSource || undefined,
        limit: 50,
      };

      // Add decay overrides if advanced mode is active
      if (useRecencyBias) {
        options.strength_weight = strengthWeight;
        options.decay_half_life_days = decayHalfLife;
      }

      const data = await api.searchMemories(selectedProject, query.trim(), options);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const highlightQuery = (text: string | undefined, maxLength = 300) => {
    if (!text) return <span className={styles.contentUnavailable}>(Content unavailable)</span>;
    const truncated = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    if (!query.trim()) return truncated;

    const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = truncated.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Search</h1>
        <p className={styles.pageSubtitle}>Semantic search across your memories</p>
      </div>

      {/* Search Form */}
      <form className={styles.searchForm} onSubmit={handleSearch}>
        <div className={styles.searchRow}>
          <div className={styles.searchInputWrapper}>
            <svg
              className={styles.searchIcon}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search for memories..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className={styles.searchBtn}
            disabled={!selectedProject || !query.trim() || searching}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Source Filter</span>
            <div className={styles.typeFilters}>
              <button
                type="button"
                className={`${styles.typeChip} ${!selectedSource ? styles.active : ''}`}
                onClick={() => setSelectedSource(null)}
              >
                All
              </button>
              {SOURCE_TYPES.map((source) => (
                <button
                  key={source}
                  type="button"
                  className={`${styles.typeChip} ${selectedSource === source ? styles.active : ''}`}
                  onClick={() => setSelectedSource(source)}
                >
                  {SOURCE_LABELS[source]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={`${styles.advancedToggle} ${showAdvanced ? styles.active : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v18M3 12h18" />
            </svg>
            Advanced
          </button>
        </div>

        {showAdvanced && (
          <div className={styles.advancedOptions}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={useRecencyBias}
                onChange={(e) => setUseRecencyBias(e.target.checked)}
              />
              <span>Override project defaults</span>
            </label>

            {useRecencyBias && (
              <div className={styles.sliderRow}>
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <label className={styles.sliderLabel}>Recency Weight</label>
                    <span className={styles.sliderValue}>{(strengthWeight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={strengthWeight * 100}
                    onChange={(e) => setStrengthWeight(Number(e.target.value) / 100)}
                    className={styles.slider}
                  />
                  <div className={styles.sliderHint}>
                    <span>Semantic</span>
                    <span>Recency</span>
                  </div>
                </div>

                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <label className={styles.sliderLabel}>Decay Half-Life</label>
                    <span className={styles.sliderValue}>{decayHalfLife} days</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="365"
                    value={decayHalfLife}
                    onChange={(e) => setDecayHalfLife(Number(e.target.value))}
                    className={styles.slider}
                  />
                  <div className={styles.sliderHint}>
                    <span>Aggressive</span>
                    <span>Slow</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      {error && <div className={styles.error}>{error}</div>}

      {/* Results */}
      {!selectedProject ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          }
          title="Select a project"
          description="Choose a project to search its memories"
        />
      ) : results === null ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          }
          title="Search your memories"
          description="Enter a query to find relevant memories using semantic search"
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          }
          title="No results found"
          description="Try a different query or adjust your filters"
        />
      ) : (
        <>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsCount}>
              Found <strong>{results.length}</strong> result{results.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className={styles.resultsList}>
            {results.map((result, index) => (
              <motion.div
                key={result.memory.id}
                className={styles.resultCard}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                onClick={() => setSelectedResult(result)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.resultHeader}>
                  <span className={styles.resultTitle}>
                    {result.memory.title || result.memory.file_path || result.memory.id.slice(0, 12)}
                  </span>
                  <div className={styles.resultMeta}>
                    <div className={styles.resultScore}>
                      {result.combined_score !== undefined ? (
                        <div className={styles.scoreBreakdown} title={`Semantic: ${((result.score || result.similarity) * 100).toFixed(0)}% | Recency: ${((result.strength || 0) * 100).toFixed(0)}%`}>
                          <div className={styles.scoreBar}>
                            <div
                              className={styles.scoreFill}
                              style={{ width: `${result.combined_score * 100}%` }}
                            />
                          </div>
                          <span>{(result.combined_score * 100).toFixed(0)}%</span>
                        </div>
                      ) : (
                        <>
                          <div className={styles.scoreBar}>
                            <div
                              className={styles.scoreFill}
                              style={{ width: `${result.similarity * 100}%` }}
                            />
                          </div>
                          <span>{(result.similarity * 100).toFixed(0)}%</span>
                        </>
                      )}
                    </div>
                    <SourceBadge source={result.memory.source} />
                  </div>
                </div>

                <div className={styles.resultContent}>
                  {highlightQuery(result.content)}
                </div>

                {result.memory.file_path && (
                  <div className={styles.resultFilePath}>
                    <code>{result.memory.file_path}</code>
                    {result.memory.line_start != null && (
                      <span className={styles.lineRange}>
                        {result.memory.line_end != null && result.memory.line_end !== result.memory.line_start
                          ? `lines ${result.memory.line_start}–${result.memory.line_end}`
                          : `line ${result.memory.line_start}`}
                      </span>
                    )}
                  </div>
                )}

                <div className={styles.resultFooter}>
                  <span className={styles.resultDate}>{formatRelativeDate(result.memory.created_at)}</span>
                  {result.memory.tags && result.memory.tags.length > 0 && (
                    <div className={styles.resultTags}>
                      {result.memory.tags.slice(0, 3).map((tag, i) => (
                        <button
                          key={i}
                          className={styles.tag}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/memories?tag=${encodeURIComponent(tag)}`);
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                      {result.memory.tags.length > 3 && (
                        <span className={styles.tagMore}>+{result.memory.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                  {result.memory.keywords && result.memory.keywords.length > 0 && (
                    <div className={styles.resultKeywords}>
                      {result.memory.keywords.slice(0, 4).map((keyword, i) => (
                        <span key={i} className={styles.keyword}>
                          {keyword}
                        </span>
                      ))}
                      {result.memory.keywords.length > 4 && (
                        <span className={styles.keyword}>+{result.memory.keywords.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Memory Detail Modal */}
      <MemoryDetailModal
        isOpen={selectedResult !== null}
        onClose={() => setSelectedResult(null)}
        memory={selectedResult?.memory || null}
        projectId={selectedProject}
        scoreInfo={
          selectedResult
            ? {
                combined_score: selectedResult.combined_score,
                similarity: selectedResult.similarity,
                score: selectedResult.score,
                strength: selectedResult.strength,
              }
            : undefined
        }
      />
    </motion.div>
  );
}
