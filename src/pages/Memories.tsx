import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import { useProject } from '../stores/project';
import { useAuth } from '../stores/auth';
import type { Memory, MemorySource, Project } from '../lib/api';
import { Modal, EmptyState, SourceBadge, Pagination } from '../components/ui';
import { MemoryDetailModal } from '../components/MemoryDetailModal';
import styles from './Memories.module.css';

const SOURCE_TYPES: MemorySource[] = ['file', 'manual', 'generated'];
const SOURCE_LABELS: Record<MemorySource, string> = {
  file: 'File',
  manual: 'Manual',
  generated: 'Generated',
};
const ITEMS_PER_PAGE = 20;

export function Memories() {
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') ?? false;
  const selectedProject = selectedProjectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSource, setSelectedSource] = useState<MemorySource | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  // Sync tag filter from URL params
  useEffect(() => {
    const tagsParam = searchParams.get('tags');
    const tagParam = searchParams.get('tag');

    if (tagsParam) {
      const tags = tagsParam.split(',').filter(Boolean);
      if (JSON.stringify(tags) !== JSON.stringify(selectedTags)) {
        setSelectedTags(tags);
        setCurrentPage(1);
      }
    } else if (tagParam) {
      // Support single tag param for backwards compatibility / incoming links
      if (selectedTags.length !== 1 || selectedTags[0] !== tagParam) {
        setSelectedTags([tagParam]);
        setCurrentPage(1);
      }
    } else if (selectedTags.length > 0) {
      setSelectedTags([]);
      setCurrentPage(1);
    }
  }, [searchParams]);

  // Helper to add a tag to the selection
  const addTag = (tag: string) => {
    if (selectedTags.includes(tag)) return;
    const newTags = [...selectedTags, tag];
    setSelectedTags(newTags);
    setSearchParams({ tags: newTags.join(',') });
    setCurrentPage(1);
  };

  // Helper to remove a tag from the selection
  const removeTag = (tag: string) => {
    const newTags = selectedTags.filter((t) => t !== tag);
    setSelectedTags(newTags);
    if (newTags.length > 0) {
      setSearchParams({ tags: newTags.join(',') });
    } else {
      setSearchParams({});
    }
    setCurrentPage(1);
  };

  // Helper to clear all tags
  const clearAllTags = () => {
    setSelectedTags([]);
    setSearchParams({});
    setCurrentPage(1);
  };

  // Projects are fetched by ProjectSelector, but we warm the cache here
  useSWR<Project[]>('projects', api.listProjects);

  const memoriesKey = selectedProject
    ? ['memories', selectedProject, selectedSource, selectedTags.join(','), currentPage]
    : null;

  const { data: memoriesData, isLoading } = useSWR(
    memoriesKey,
    () =>
      api.listMemories(selectedProject!, {
        source: selectedSource || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      }),
    { refreshInterval: 10000 }
  );

  const memories = memoriesData?.memories || [];
  const totalPages = Math.ceil((memoriesData?.total || 0) / ITEMS_PER_PAGE);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject || !isAdmin) return;

    setCreating(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const tagsInput = formData.get('tags') as string;
    const slugInput = formData.get('slug') as string;
    const data = {
      title: formData.get('title') as string || undefined,
      content: formData.get('content') as string || '',
      source: 'manual' as MemorySource,
      tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      slug: slugInput?.trim() || undefined,
      author: 'ui',
    };

    try {
      await api.createMemory(selectedProject, data);
      mutate(memoriesKey);
      setIsCreateOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memory');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (memory: Memory) => {
    if (!selectedProject || !isAdmin) return;
    if (!confirm('Delete this memory? This cannot be undone.')) return;

    try {
      await api.deleteMemory(selectedProject, memory.id);
      mutate(memoriesKey);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete memory');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Memories</h1>
          <p className={styles.pageSubtitle}>Browse and manage project memories</p>
        </div>
        {selectedProject && (
          <button className={styles.addBtn} onClick={() => setIsCreateOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Memory
          </button>
        )}
      </div>

      {/* Filters */}
      {selectedProject && (
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Source</span>
            <div className={styles.typeFilters}>
              <button
                className={`${styles.typeChip} ${!selectedSource ? styles.active : ''}`}
                onClick={() => {
                  setSelectedSource(null);
                  setCurrentPage(1);
                }}
              >
                All
              </button>
              {SOURCE_TYPES.map((source) => (
                <button
                  key={source}
                  className={`${styles.typeChip} ${selectedSource === source ? styles.active : ''}`}
                  onClick={() => {
                    setSelectedSource(source);
                    setCurrentPage(1);
                  }}
                >
                  {SOURCE_LABELS[source]}
                </button>
              ))}
            </div>
          </div>

          {/* Active tag filters */}
          {selectedTags.length > 0 && (
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Tags</span>
              <div className={styles.activeTagFilter}>
                {selectedTags.map((tag) => (
                  <span key={tag} className={styles.activeTag}>
                    {tag}
                    <button
                      className={styles.removeTagBtn}
                      onClick={() => removeTag(tag)}
                      title={`Remove ${tag}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedTags.length > 1 && (
                  <button
                    className={styles.clearAllTagsBtn}
                    onClick={clearAllTags}
                    title="Clear all tags"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {!selectedProject ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
          title="Select a project"
          description="Choose a project from the dropdown to view its memories"
        />
      ) : isLoading ? (
        <div className={styles.loading}>Loading memories...</div>
      ) : memories.length === 0 ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          }
          title="No memories yet"
          description={selectedSource ? `No ${SOURCE_LABELS[selectedSource].toLowerCase()} memories found` : 'This project has no memories'}
          action={{
            label: 'Add Memory',
            onClick: () => setIsCreateOpen(true),
          }}
        />
      ) : (
        <>
          <div className={styles.memoryList}>
            {memories.map((memory) => (
              <motion.div
                key={memory.id}
                className={styles.memoryCard}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedMemory(memory)}
              >
                <div className={styles.memoryHeader}>
                  <span className={styles.memoryTitle}>
                    {memory.title || memory.file_path || memory.id.slice(0, 12)}
                  </span>
                  <div className={styles.memoryMeta}>
                    <span className={styles.memoryDate}>{formatDate(memory.created_at)}</span>
                    <SourceBadge source={memory.source} />
                    {isAdmin && (
                      <button
                        className={styles.deleteIconBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(memory);
                        }}
                        title="Delete memory"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                {memory.content && (
                  <p className={styles.memoryPreview}>
                    {memory.content.length > 300
                      ? memory.content.slice(0, 300) + '...'
                      : memory.content}
                  </p>
                )}

                {/* Tags */}
                {memory.tags && memory.tags.length > 0 && (
                  <div className={styles.memoryTagsPreview}>
                    {memory.tags.map((tag, i) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={i}
                          className={`${styles.tagPreview} ${isSelected ? styles.tagSelected : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              removeTag(tag);
                            } else {
                              addTag(tag);
                            }
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.paginationWrapper}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Memory"
        footer={
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="create-memory-form"
              className={styles.submitBtn}
              disabled={creating}
            >
              {creating ? 'Adding...' : 'Add Memory'}
            </button>
          </div>
        }
      >
        <form id="create-memory-form" className={styles.form} onSubmit={handleCreate}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="title">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className={styles.input}
              placeholder="Enter a title for this memory..."
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="content">
              Content *
            </label>
            <textarea
              id="content"
              name="content"
              className={styles.input}
              placeholder="Enter the memory content..."
              rows={6}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="tags">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              className={styles.input}
              placeholder="tag1, tag2, tag3 (comma-separated)"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="slug">
              Slug <span className={styles.labelHint}>(optional)</span>
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              className={styles.input}
              placeholder="custom-slug (auto-generated from title if empty)"
            />
            <span className={styles.fieldHint}>
              Used for the file path in fold/ directory
            </span>
          </div>
        </form>
      </Modal>

      {/* Memory Detail Modal */}
      <MemoryDetailModal
        isOpen={selectedMemory !== null}
        onClose={() => setSelectedMemory(null)}
        memory={selectedMemory}
        projectId={selectedProject}
        selectedTags={selectedTags}
      />
    </motion.div>
  );
}
