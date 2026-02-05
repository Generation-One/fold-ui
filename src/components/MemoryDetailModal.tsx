import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';
import type { Memory, MemoryContext } from '../lib/api';
import { Modal } from './ui';
import styles from './MemoryDetailModal.module.css';

interface MemoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: Memory | null;
  projectId: string | null;
  // Optional: search result score info
  scoreInfo?: {
    combined_score?: number;
    similarity?: number;
    score?: number;
    strength?: number;
  };
  // Optional: currently selected tags (for highlighting and additive filtering)
  selectedTags?: string[];
}

export function MemoryDetailModal({
  isOpen,
  onClose,
  memory,
  projectId,
  scoreInfo,
  selectedTags = [],
}: MemoryDetailModalProps) {
  const navigate = useNavigate();
  const [context, setContext] = useState<MemoryContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [currentMemory, setCurrentMemory] = useState<Memory | null>(null);

  // Load memory context when memory changes
  useEffect(() => {
    if (!isOpen || !memory || !projectId) {
      setContext(null);
      setCurrentMemory(null);
      return;
    }

    setCurrentMemory(memory);
    setLoading(true);
    setContext(null);

    api
      .getMemoryContext(projectId, memory.id)
      .then(setContext)
      .catch((err) => console.error('Failed to load memory context:', err))
      .finally(() => setLoading(false));
  }, [isOpen, memory?.id, projectId]);

  const handleNavigateToRelated = async (relatedId: string) => {
    if (!projectId) return;

    setLoading(true);
    try {
      const newContext = await api.getMemoryContext(projectId, relatedId);
      if (newContext?.memory) {
        setCurrentMemory(newContext.memory);
        setContext(newContext);
      }
    } catch (err) {
      console.error('Failed to load related memory:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Strip content after the first --- line (removes related content lists)
  const stripTrailingMetadata = (content: string) => {
    const lines = content.split('\n');
    const hrIndex = lines.findIndex((line) => line.trim() === '---');
    if (hrIndex > 0) {
      return lines.slice(0, hrIndex).join('\n').trim();
    }
    return content;
  };

  // Use context.memory (has full data including tags) when available,
  // otherwise fall back to currentMemory or the original prop
  const displayMemory = context?.memory || currentMemory || memory;

  // Download the original source file
  const handleDownload = async () => {
    if (!projectId || !displayMemory?.id || !displayMemory?.file_path) return;

    setDownloading(true);
    try {
      const { blob, filename } = await api.downloadSourceFile(projectId, displayMemory.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download source file:', err);
      // Could add a toast notification here
    } finally {
      setDownloading(false);
    }
  };

  if (!displayMemory) return null;

  // Get the title for the modal header
  const modalTitle = displayMemory.title || displayMemory.file_path || 'Memory Details';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} wide>
      <div className={styles.content}>
        {/* Header row - file path, source, and date */}
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            {displayMemory.file_path && (
              <div className={styles.filePath}>
                <button
                  className={styles.downloadButton}
                  onClick={handleDownload}
                  title="Download source file"
                  disabled={downloading || !projectId}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <code>{displayMemory.file_path}</code>
                </button>
                {displayMemory.language && <span className={styles.language}>{displayMemory.language}</span>}
              </div>
            )}
            {displayMemory.source && (
              <span className={styles.source}>{displayMemory.source}</span>
            )}
          </div>
          <span className={styles.date}>{formatDate(displayMemory.created_at)}</span>
        </div>

        {/* Main content */}
        <div className={styles.mainContent}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : context?.memory?.content ? (
            <div className={styles.markdown}>
              <ReactMarkdown>{stripTrailingMetadata(context.memory.content)}</ReactMarkdown>
            </div>
          ) : displayMemory.context ? (
            <div className={styles.markdown}>
              <ReactMarkdown>{stripTrailingMetadata(displayMemory.context)}</ReactMarkdown>
            </div>
          ) : displayMemory.content ? (
            <div className={styles.markdown}>
              <ReactMarkdown>{stripTrailingMetadata(displayMemory.content)}</ReactMarkdown>
            </div>
          ) : (
            <p className={styles.noContent}>No content available</p>
          )}
        </div>

        {/* Score info (only show for search results on the original memory) */}
        {scoreInfo && currentMemory?.id === memory?.id && (
          <div className={styles.scores}>
            <div className={styles.scoreItem}>
              <span className={styles.scoreLabel}>Match</span>
              <span className={styles.scoreValue}>
                {((scoreInfo.combined_score ?? scoreInfo.similarity ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
            {scoreInfo.combined_score !== undefined && (
              <>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreLabel}>Semantic</span>
                  <span className={styles.scoreValue}>
                    {((scoreInfo.score || scoreInfo.similarity || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreLabel}>Recency</span>
                  <span className={styles.scoreValue}>
                    {((scoreInfo.strength || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Keywords */}
        {displayMemory.keywords && displayMemory.keywords.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Keywords</span>
            <div className={styles.keywords}>
              {displayMemory.keywords.map((keyword, i) => (
                <span key={i} className={styles.keyword}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {displayMemory.tags && displayMemory.tags.length > 0 && (
          <div className={styles.tags}>
            {displayMemory.tags.map((tag, i) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={i}
                  className={`${styles.tag} ${isSelected ? styles.tagSelected : ''}`}
                  onClick={() => {
                    onClose();
                    // Add to existing tags if not already selected
                    const newTags = isSelected
                      ? selectedTags.filter((t) => t !== tag)
                      : [...selectedTags, tag];
                    if (newTags.length > 0) {
                      navigate(`/memories?tags=${newTags.map(encodeURIComponent).join(',')}`);
                    } else {
                      navigate('/memories');
                    }
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        {/* Related memories from context */}
        {context?.related && context.related.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Related Memories</span>
            <div className={styles.relatedList}>
              {context.related.map((related) => (
                <button
                  key={related.id}
                  className={styles.relatedItem}
                  onClick={() => handleNavigateToRelated(related.id)}
                >
                  <div className={styles.relatedHeader}>
                    <span className={styles.relatedTitle}>
                      {related.title || related.id.slice(0, 12)}
                    </span>
                    <span className={styles.relatedType}>{related.link_type}</span>
                  </div>
                  <p className={styles.relatedPreview}>
                    {related.content_preview.length > 100
                      ? related.content_preview.slice(0, 100) + '...'
                      : related.content_preview}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Similar memories from context */}
        {context?.similar && context.similar.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Similar Memories</span>
            <div className={styles.relatedList}>
              {context.similar.map((similar) => (
                <button
                  key={similar.id}
                  className={styles.relatedItem}
                  onClick={() => handleNavigateToRelated(similar.id)}
                >
                  <div className={styles.relatedHeader}>
                    <span className={styles.relatedTitle}>
                      {similar.title || similar.id.slice(0, 12)}
                    </span>
                    <span className={styles.relatedScore}>{(similar.score * 100).toFixed(0)}%</span>
                  </div>
                  <p className={styles.relatedPreview}>
                    {similar.content_preview.length > 100
                      ? similar.content_preview.slice(0, 100) + '...'
                      : similar.content_preview}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Legacy links (if no context loaded) */}
        {!context && displayMemory.links && displayMemory.links.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Linked Memories</span>
            <div className={styles.linkIds}>
              {displayMemory.links.map((linkId, i) => (
                <button
                  key={i}
                  className={styles.linkId}
                  onClick={() => handleNavigateToRelated(linkId)}
                >
                  {linkId.slice(0, 12)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className={styles.meta}>
          {displayMemory.author && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Author</span>
              <span className={styles.metaValue}>{displayMemory.author}</span>
            </div>
          )}
          {displayMemory.updated_at && displayMemory.updated_at !== displayMemory.created_at && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Updated</span>
              <span className={styles.metaValue}>{formatDate(displayMemory.updated_at)}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
