import { useState } from 'react';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import type { Memory, Project } from '../lib/api';
import { Modal, EmptyState, TypeBadge, ProjectSelector, Pagination } from '../components/ui';
import type { MemoryType } from '../components/ui';
import styles from './Memories.module.css';

const MEMORY_TYPES: MemoryType[] = ['codebase', 'session', 'spec', 'decision', 'task', 'general'];
const ITEMS_PER_PAGE = 20;

export function Memories() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<MemoryType | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Projects are fetched by ProjectSelector, but we warm the cache here
  useSWR<Project[]>('projects', api.listProjects);

  const memoriesKey = selectedProject
    ? ['memories', selectedProject, selectedType, currentPage]
    : null;

  const { data: memoriesData, isLoading } = useSWR(
    memoriesKey,
    () =>
      api.listMemories(selectedProject!, {
        type: selectedType || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      }),
    { refreshInterval: 10000 }
  );

  const memories = memoriesData?.memories || [];
  const totalPages = Math.ceil((memoriesData?.total || 0) / ITEMS_PER_PAGE);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject) return;

    setCreating(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const tagsInput = formData.get('tags') as string;
    const data = {
      content: formData.get('content') as string,
      type: formData.get('type') as MemoryType,
      tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
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
    if (!selectedProject) return;
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

  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
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
        <button
          className={styles.createBtn}
          onClick={() => setIsCreateOpen(true)}
          disabled={!selectedProject}
          title={!selectedProject ? 'Select a project first' : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Memory
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Project</span>
          <ProjectSelector
            value={selectedProject}
            onChange={(id) => {
              setSelectedProject(id);
              setCurrentPage(1);
            }}
            placeholder="Select a project..."
          />
        </div>

        {selectedProject && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Type</span>
            <div className={styles.typeFilters}>
              <button
                className={`${styles.typeChip} ${!selectedType ? styles.active : ''}`}
                onClick={() => {
                  setSelectedType(null);
                  setCurrentPage(1);
                }}
              >
                All
              </button>
              {MEMORY_TYPES.map((type) => (
                <button
                  key={type}
                  className={`${styles.typeChip} ${selectedType === type ? styles.active : ''}`}
                  onClick={() => {
                    setSelectedType(type);
                    setCurrentPage(1);
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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
          description={selectedType ? `No ${selectedType} memories found` : 'This project has no memories'}
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
              >
                <div
                  className={styles.memoryHeader}
                  onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
                >
                  <div className={styles.memoryHeaderLeft}>
                    <TypeBadge type={memory.type as MemoryType} />
                    <span className={styles.memoryTitle}>
                      {truncateContent(memory.content)}
                    </span>
                  </div>
                  <div className={styles.memoryMeta}>
                    <span className={styles.memoryDate}>{formatDate(memory.created_at)}</span>
                    <svg
                      className={`${styles.expandIcon} ${expandedId === memory.id ? styles.expanded : ''}`}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {expandedId === memory.id && (
                  <div className={styles.memoryContent}>
                    <p className={styles.memoryText}>{memory.content}</p>
                    {memory.tags && memory.tags.length > 0 && (
                      <div className={styles.memoryTags}>
                        {memory.tags.map((tag, i) => (
                          <span key={i} className={styles.tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={styles.memoryActions}>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(memory)}>
                        Delete
                      </button>
                    </div>
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
            <label className={styles.label} htmlFor="type">
              Type *
            </label>
            <select id="type" name="type" className={styles.select} required defaultValue="general">
              {MEMORY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="content">
              Content *
            </label>
            <textarea
              id="content"
              name="content"
              className={styles.textarea}
              placeholder="Enter the memory content..."
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
        </form>
      </Modal>
    </motion.div>
  );
}
