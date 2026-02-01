import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useProject } from '../stores/project';
import type { SearchResult, Project } from '../lib/api';
import { EmptyState, TypeBadge, Modal } from '../components/ui';
import type { MemoryType } from '../components/ui';
import useSWR from 'swr';
import styles from './Search.module.css';

const MEMORY_TYPES: MemoryType[] = ['codebase', 'session', 'spec', 'decision', 'task', 'general'];

export function Search() {
  const { selectedProjectId } = useProject();
  const selectedProject = selectedProjectId;
  const [selectedType, setSelectedType] = useState<MemoryType | null>(null);
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
  useSWR<Project[]>('projects', api.listProjects);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !query.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const options: {
        type?: string;
        limit: number;
        strength_weight?: number;
        decay_half_life_days?: number;
      } = {
        type: selectedType || undefined,
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

  const highlightQuery = (text: string, maxLength = 300) => {
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
            <span className={styles.filterLabel}>Type Filter</span>
            <div className={styles.typeFilters}>
              <button
                type="button"
                className={`${styles.typeChip} ${!selectedType ? styles.active : ''}`}
                onClick={() => setSelectedType(null)}
              >
                All
              </button>
              {MEMORY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.typeChip} ${selectedType === type ? styles.active : ''}`}
                  onClick={() => setSelectedType(type)}
                >
                  {type}
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
                  <div className={styles.resultHeaderLeft}>
                    <TypeBadge type={result.memory.type as MemoryType} />
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
                  {highlightQuery(result.memory.content)}
                </div>

                <div className={styles.resultMeta}>
                  <span>{formatDate(result.memory.created_at)}</span>
                  {result.memory.tags && result.memory.tags.length > 0 && (
                    <div className={styles.resultTags}>
                      {result.memory.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className={styles.tag}>
                          {tag}
                        </span>
                      ))}
                      {result.memory.tags.length > 3 && (
                        <span className={styles.tag}>+{result.memory.tags.length - 3}</span>
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
        onClose={() => setSelectedResult(null)}
        wide
      >
        {selectedResult && (
          <div className={styles.modalContent}>
            <div className={styles.modalRow}>
              <TypeBadge type={selectedResult.memory.type as MemoryType} />
              <span className={styles.modalDate}>
                {formatFullDate(selectedResult.memory.created_at)}
              </span>
            </div>

            {selectedResult.memory.title && (
              <h3 className={styles.modalTitle}>{selectedResult.memory.title}</h3>
            )}

            <div className={styles.modalBody}>
              {selectedResult.memory.content}
            </div>

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

            {/* Metadata */}
            <div className={styles.modalMeta}>
              {selectedResult.memory.file_path && (
                <div className={styles.modalMetaItem}>
                  <span className={styles.modalMetaLabel}>File</span>
                  <code className={styles.modalMetaValue}>{selectedResult.memory.file_path}</code>
                </div>
              )}
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
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
