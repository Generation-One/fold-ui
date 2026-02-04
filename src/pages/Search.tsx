import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useProject } from '../stores/project';
import type { SearchResult, MemorySource, Project } from '../lib/api';
import { EmptyState, SourceBadge, Modal } from '../components/ui';
import useSWR from 'swr';
import styles from './Search.module.css';

const SOURCE_TYPES: MemorySource[] = ['file', 'manual', 'generated'];
const SOURCE_LABELS: Record<MemorySource, string> = {
  file: 'File',
  manual: 'Manual',
  generated: 'Generated',
};

export function Search() {
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
  const [fullMemoryContext, setFullMemoryContext] = useState<any | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Projects are fetched by ProjectSelector, but we warm the cache here
  useSWR<Project[]>('projects', api.listProjects);

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSelectResult = async (result: SearchResult) => {
    setSelectedResult(result);
    setLoadingContext(true);
    setFullMemoryContext(null);
    try {
      if (selectedProject) {
        const context = await api.getMemoryContext(selectedProject, result.memory.id);
        setFullMemoryContext(context);
      }
    } catch (err) {
      console.error('Failed to fetch memory context:', err);
    } finally {
      setLoadingContext(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedResult(null);
    setFullMemoryContext(null);
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
                onClick={() => handleSelectResult(result)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.resultHeader}>
                  <div className={styles.resultHeaderLeft}>
                    <SourceBadge source={result.memory.source} />
                    {result.memory.title && (
                      <span className={styles.resultTitle}>{result.memory.title}</span>
                    )}
                  </div>
                  <div className={styles.resultScore}>
                    {result.combined_score !== undefined ? (
                      <>
                        <div className={styles.scoreBreakdown} title={`Semantic: ${((result.score || result.similarity) * 100).toFixed(0)}% | Recency: ${((result.strength || 0) * 100).toFixed(0)}%`}>
                          <div className={styles.scoreBar}>
                            <div
                              className={styles.scoreFill}
                              style={{ width: `${result.combined_score * 100}%` }}
                            />
                          </div>
                          <span>{(result.combined_score * 100).toFixed(0)}%</span>
                        </div>
                      </>
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
                </div>

                <div className={styles.resultContent}>
                  {highlightQuery(result.content)}
                </div>

                {result.memory.file_path && (
                  <div className={styles.resultFilePath}>
                    <code>{result.memory.file_path}</code>
                  </div>
                )}

                <div className={styles.resultMeta}>
                  <span>{formatDate(result.memory.created_at)}</span>
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
      <Modal
        isOpen={selectedResult !== null}
        title="Memory Details"
        onClose={handleCloseModal}
        wide
      >
        {selectedResult && (
          <div className={styles.modalContent}>
            <div className={styles.modalRow}>
              <SourceBadge source={selectedResult.memory.source} />
              <span className={styles.modalDate}>
                {formatFullDate(selectedResult.memory.created_at)}
              </span>
            </div>

            {selectedResult.memory.title && (
              <h3 className={styles.modalTitle}>{selectedResult.memory.title}</h3>
            )}

            {/* Content */}
            {loadingContext ? (
              <div className={styles.modalContext}>
                Loading full content...
              </div>
            ) : fullMemoryContext?.memory?.content ? (
              <div className={styles.modalContext}>
                {fullMemoryContext.memory.content}
              </div>
            ) : selectedResult.memory.context ? (
              <div className={styles.modalContext}>
                {selectedResult.memory.context}
              </div>
            ) : null}

            {/* File path */}
            {selectedResult.memory.file_path && (
              <div className={styles.modalFilePath}>
                <code>{selectedResult.memory.file_path}</code>
                {selectedResult.memory.language && (
                  <span className={styles.language}>{selectedResult.memory.language}</span>
                )}
              </div>
            )}

            {/* Score breakdown */}
            <div className={styles.modalScores}>
              <div className={styles.modalScoreItem}>
                <span className={styles.modalScoreLabel}>Match Score</span>
                <span className={styles.modalScoreValue}>
                  {((selectedResult.combined_score ?? selectedResult.similarity) * 100).toFixed(1)}%
                </span>
              </div>
              {selectedResult.combined_score !== undefined && (
                <>
                  <div className={styles.modalScoreItem}>
                    <span className={styles.modalScoreLabel}>Semantic</span>
                    <span className={styles.modalScoreValue}>
                      {((selectedResult.score || selectedResult.similarity) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.modalScoreItem}>
                    <span className={styles.modalScoreLabel}>Recency</span>
                    <span className={styles.modalScoreValue}>
                      {((selectedResult.strength || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Keywords */}
            {selectedResult.memory.keywords && selectedResult.memory.keywords.length > 0 && (
              <div className={styles.modalKeywords}>
                <span className={styles.modalKeywordsLabel}>Keywords:</span>
                {selectedResult.memory.keywords.map((keyword, i) => (
                  <span key={i} className={styles.modalKeyword}>{keyword}</span>
                ))}
              </div>
            )}

            {/* Metadata */}
            <div className={styles.modalMeta}>
              {selectedResult.memory.author && (
                <div className={styles.modalMetaItem}>
                  <span className={styles.modalMetaLabel}>Author</span>
                  <span className={styles.modalMetaValue}>{selectedResult.memory.author}</span>
                </div>
              )}
              {selectedResult.memory.updated_at && selectedResult.memory.updated_at !== selectedResult.memory.created_at && (
                <div className={styles.modalMetaItem}>
                  <span className={styles.modalMetaLabel}>Updated</span>
                  <span className={styles.modalMetaValue}>{formatFullDate(selectedResult.memory.updated_at)}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {selectedResult.memory.tags && selectedResult.memory.tags.length > 0 && (
              <div className={styles.modalTags}>
                {selectedResult.memory.tags.map((tag, i) => (
                  <span key={i} className={styles.modalTag}>{tag}</span>
                ))}
              </div>
            )}

            {/* Related memories */}
            {selectedResult.memory.links && selectedResult.memory.links.length > 0 && (
              <div className={styles.modalLinks}>
                <span className={styles.modalLinksLabel}>Related memories:</span>
                <div className={styles.modalLinksGrid}>
                  {selectedResult.memory.links.map((linkId, i) => (
                    <span key={i} className={styles.modalLinkId}>{linkId.slice(0, 12)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
