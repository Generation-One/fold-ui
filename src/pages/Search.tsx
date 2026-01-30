import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import type { SearchResult, Project } from '../lib/api';
import { EmptyState, TypeBadge, ProjectSelector } from '../components/ui';
import type { MemoryType } from '../components/ui';
import useSWR from 'swr';
import styles from './Search.module.css';

const MEMORY_TYPES: MemoryType[] = ['codebase', 'session', 'spec', 'decision', 'task', 'general'];

export function Search() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<MemoryType | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Projects are fetched by ProjectSelector, but we warm the cache here
  useSWR<Project[]>('projects', api.listProjects);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !query.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const data = await api.searchMemories(selectedProject, query.trim(), {
        type: selectedType || undefined,
        limit: 50,
      });
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
            <span className={styles.filterLabel}>Project</span>
            <ProjectSelector
              value={selectedProject}
              onChange={(id) => {
                setSelectedProject(id);
                setResults(null);
              }}
              placeholder="Select a project..."
            />
          </div>

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
        </div>
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
              >
                <div className={styles.resultHeader}>
                  <div className={styles.resultHeaderLeft}>
                    <TypeBadge type={result.memory.type as MemoryType} />
                  </div>
                  <div className={styles.resultScore}>
                    <div className={styles.scoreBar}>
                      <div
                        className={styles.scoreFill}
                        style={{ width: `${result.similarity * 100}%` }}
                      />
                    </div>
                    <span>{(result.similarity * 100).toFixed(0)}%</span>
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
    </motion.div>
  );
}
