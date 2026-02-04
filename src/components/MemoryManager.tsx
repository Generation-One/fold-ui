import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import type { Memory } from '../lib/api';
import { useToast } from './ToastContext';
import { Modal, SourceBadge } from './ui';
import styles from './ProjectMemberManager.module.css';

interface MemoryManagerProps {
  projectId: string;
}

export function MemoryManager({ projectId }: MemoryManagerProps) {
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    tags: '',
    author: '',
  });

  const [editFormData, setEditFormData] = useState({
    title: '',
    tags: '',
    author: '',
  });

  // Fetch memories
  const { data: memoriesData, isLoading } = useSWR(
    projectId ? `admin/memories/${projectId}` : null,
    () => projectId ? api.listMemories(projectId, { limit: 50 }) : Promise.resolve({ memories: [], total: 0 })
  );

  const memories = memoriesData?.memories || [];

  const filteredMemories = memories.filter(m =>
    m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.author?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    setIsCreating(true);
    try {
      await api.createMemory(projectId, {
        title: formData.title,
        author: formData.author || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        source: 'manual',
      });
      showToast('Memory created successfully', 'success');
      setFormData({ title: '', tags: '', author: '' });
      setIsCreateOpen(false);
      mutate(`admin/memories/${projectId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create memory', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedMemory || !editFormData.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      await api.updateMemory(projectId, selectedMemory.id, {
        title: editFormData.title,
        author: editFormData.author || undefined,
        tags: editFormData.tags ? editFormData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      });
      showToast('Memory updated successfully', 'success');
      setIsEditOpen(false);
      setSelectedMemory(null);
      mutate(`admin/memories/${projectId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update memory', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (memoryId: string) => {
    if (!confirm('Delete this memory? This action cannot be undone.')) return;

    try {
      await api.deleteMemory(projectId, memoryId);
      showToast('Memory deleted successfully', 'success');
      mutate(`admin/memories/${projectId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete memory', 'error');
    }
  };

  const handleEdit = (memory: Memory) => {
    setSelectedMemory(memory);
    setEditFormData({
      title: memory.title || '',
      tags: memory.tags?.join(', ') || '',
      author: memory.author || '',
    });
    setIsEditOpen(true);
  };

  return (
    <div className={styles.container}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
        <input
          type="text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '0.5rem',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--elevated)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={() => {
            setFormData({ title: '', tags: '', author: '' });
            setIsCreateOpen(true);
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--holo-cyan)',
            color: 'var(--bg-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          + Create Memory
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          Loading memories...
        </div>
      ) : filteredMemories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          No memories found
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {filteredMemories.map((memory) => (
            <div
              key={memory.id}
              style={{
                padding: '1rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                  <SourceBadge source={memory.source} />
                  <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>
                    {memory.title || 'Untitled'}
                  </h4>
                </div>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Author: {memory.author || '(none)'} • Created: {new Date(memory.created_at).toLocaleDateString()}
                </p>
                {memory.tags && memory.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {memory.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} style={{ fontSize: '0.8rem', backgroundColor: 'var(--elevated)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                        {tag}
                      </span>
                    ))}
                    {memory.tags.length > 3 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        +{memory.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleEdit(memory)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: 'var(--elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(memory.id)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: 'var(--status-error)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Memory">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Memory title"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--elevated)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Author
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              placeholder="Memory author"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--elevated)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Tags
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="tag1, tag2, tag3 (comma-separated)"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--elevated)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--holo-cyan)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: isCreating ? 0.6 : 1,
            }}
          >
            {isCreating ? 'Creating...' : 'Create Memory'}
          </button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Memory">
        {selectedMemory && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Title *
              </label>
              <input
                type="text"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                placeholder="Memory title"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--elevated)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Author
              </label>
              <input
                type="text"
                value={editFormData.author}
                onChange={(e) => setEditFormData({ ...editFormData, author: e.target.value })}
                placeholder="Memory author"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--elevated)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Tags
              </label>
              <input
                type="text"
                value={editFormData.tags}
                onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3 (comma-separated)"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--elevated)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--holo-cyan)',
                  color: 'var(--bg-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isUpdating ? 0.6 : 1,
                }}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setIsEditOpen(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
