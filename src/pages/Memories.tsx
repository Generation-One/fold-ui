import { useState } from 'react';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import { useProject } from '../stores/project';
import { useAuth } from '../stores/auth';
import type { Memory, MemorySource, MemoryContext, Project } from '../lib/api';
import { Modal, EmptyState, SourceBadge, Pagination } from '../components/ui';
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
  const [selectedSource, setSelectedSource] = useState<MemorySource | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<MemoryContext | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    tags: '',
    author: '',
  });

  // Projects are fetched by ProjectSelector, but we warm the cache here
  useSWR<Project[]>('projects', api.listProjects);

  const memoriesKey = selectedProject
    ? ['memories', selectedProject, selectedSource, currentPage]
    : null;

  const { data: memoriesData, isLoading } = useSWR(
    memoriesKey,
    () =>
      api.listMemories(selectedProject!, {
        source: selectedSource || undefined,
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
    const data = {
      title: formData.get('title') as string || undefined,
      content: formData.get('content') as string || '',
      source: 'manual' as MemorySource,
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

  const handleExpand = async (memoryId: string) => {
    if (expandedId === memoryId) {
      setExpandedId(null);
      setExpandedContent(null);
      return;
    }

    setExpandedId(memoryId);
    setExpandedContent(null);
    setLoadingContent(true);

    try {
      const context = await api.getMemoryContext(selectedProject!, memoryId, 1);
      setExpandedContent(context);
    } catch (err) {
      console.error('Failed to load memory content:', err);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleDelete = async (memory: Memory) => {
    if (!selectedProject || !isAdmin) return;
    if (!confirm('Delete this memory? This cannot be undone.')) return;

    try {
      await api.deleteMemory(selectedProject, memory.id);
      mutate(memoriesKey);
      if (expandedId === memory.id) {
        setExpandedId(null);
        setExpandedContent(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete memory');
    }
  };

  const handleEdit = (memory: Memory) => {
    setEditingMemory(memory);
    setEditFormData({
      title: memory.title || '',
      tags: memory.tags?.join(', ') || '',
      author: memory.author || '',
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedProject || !editingMemory || !editFormData.title.trim()) {
      setError('Title is required');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      await api.updateMemory(selectedProject, editingMemory.id, {
        title: editFormData.title,
        author: editFormData.author || undefined,
        tags: editFormData.tags ? editFormData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      });
      mutate(memoriesKey);
      setIsEditOpen(false);
      setEditingMemory(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update memory');
    } finally {
      setUpdating(false);
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
        <button
          className={styles.createBtn}
          onClick={() => setIsCreateOpen(true)}
          disabled={!selectedProject || !isAdmin}
          title={!isAdmin ? 'Only administrators can create memories' : !selectedProject ? 'Select a project first' : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Memory
        </button>
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
              >
                <div
                  className={styles.memoryHeader}
                  onClick={() => handleExpand(memory.id)}
                >
                  <div className={styles.memoryHeaderLeft}>
                    <SourceBadge source={memory.source} />
                    <span className={styles.memoryTitle}>
                      {memory.title || memory.file_path || memory.id.slice(0, 12)}
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
                    {/* Loading state */}
                    {loadingContent && (
                      <div className={styles.contentLoading}>Loading content...</div>
                    )}

                    {/* Main content */}
                    {expandedContent?.content && (
                      <pre className={styles.memoryContentText}>{expandedContent.content}</pre>
                    )}

                    {/* Context summary */}
                    {memory.context && (
                      <p className={styles.memoryText}>{memory.context}</p>
                    )}

                    {/* File path */}
                    {memory.file_path && (
                      <div className={styles.memoryFilePath}>
                        <code>{memory.file_path}</code>
                        {memory.language && <span className={styles.language}>{memory.language}</span>}
                      </div>
                    )}

                    {/* Keywords */}
                    {memory.keywords && memory.keywords.length > 0 && (
                      <div className={styles.memoryKeywords}>
                        <span className={styles.keywordLabel}>Keywords:</span>
                        {memory.keywords.map((keyword, i) => (
                          <span key={i} className={styles.keyword}>
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {memory.tags && memory.tags.length > 0 && (
                      <div className={styles.memoryTags}>
                        {memory.tags.map((tag, i) => (
                          <span key={i} className={styles.tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Related memories */}
                    {memory.links && memory.links.length > 0 && (
                      <div className={styles.memoryLinks}>
                        <span className={styles.linksLabel}>Related:</span>
                        {memory.links.slice(0, 5).map((linkId, i) => (
                          <span key={i} className={styles.linkId}>
                            {linkId.slice(0, 8)}
                          </span>
                        ))}
                        {memory.links.length > 5 && (
                          <span className={styles.linkId}>+{memory.links.length - 5} more</span>
                        )}
                      </div>
                    )}

                    {isAdmin && (
                      <div className={styles.memoryActions}>
                        <button className={styles.editBtn} onClick={() => handleEdit(memory)}>
                          Edit
                        </button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(memory)}>
                          Delete
                        </button>
                      </div>
                    )}
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
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingMemory(null);
        }}
        title="Edit Memory"
        footer={
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => {
              setIsEditOpen(false);
              setEditingMemory(null);
            }}>
              Cancel
            </button>
            <button
              className={styles.submitBtn}
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        {editingMemory && (
          <form className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="edit-title">
                Title *
              </label>
              <input
                type="text"
                id="edit-title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                className={styles.input}
                placeholder="Enter a title for this memory..."
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="edit-author">
                Author
              </label>
              <input
                type="text"
                id="edit-author"
                value={editFormData.author}
                onChange={(e) => setEditFormData({ ...editFormData, author: e.target.value })}
                className={styles.input}
                placeholder="Memory author"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="edit-tags">
                Tags
              </label>
              <input
                type="text"
                id="edit-tags"
                value={editFormData.tags}
                onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                className={styles.input}
                placeholder="tag1, tag2, tag3 (comma-separated)"
              />
            </div>
          </form>
        )}
      </Modal>
    </motion.div>
  );
}
