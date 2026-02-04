import { useState } from 'react';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../stores/auth';
import { Modal } from '../components/ui';
import styles from './AdminPanel.module.css';

// Types
interface User {
  id: string;
  email?: string;
  display_name?: string;
  role: string;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  created_by?: string;
  created_at: string;
}

interface GroupMember {
  group_id: string;
  user_id: string;
  created_at: string;
}

export function AdminPanel() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [mainTab, setMainTab] = useState<'users' | 'groups'>('users');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Users tab state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({
    email: '',
    display_name: '',
    role: 'member' as const,
  });
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [createTokenData, setCreateTokenData] = useState({
    name: '',
    expiresInDays: undefined as number | undefined,
  });
  const [newToken, setNewToken] = useState<any>(null);

  // Groups tab state
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
  });
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberData, setAddMemberData] = useState({
    user_id: '',
  });

  // Data fetching
  const { data: users, error: usersError } = useSWR<User[]>(
    'admin/users',
    () => api.listUsers()
  );

  const { data: groups, error: groupsError } = useSWR<Group[]>(
    mainTab === 'groups' ? 'admin/groups' : null,
    () => api.listGroups()
  );

  const { data: groupMembers } = useSWR<GroupMember[]>(
    selectedGroup ? `admin/group/${selectedGroup}/members` : null,
    () => selectedGroup ? api.listGroupMembers(selectedGroup) : Promise.resolve([])
  );

  // Check if user is admin
  if (!user?.roles?.includes('admin')) {
    return (
      <div className={styles.container}>
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>Access Denied</h1>
          <p>You must be an administrator to access this panel.</p>
        </motion.div>
      </div>
    );
  }

  // User Management Handlers
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await api.updateUser(editingUser.id, userFormData);
      showToast('User updated successfully', 'success');
      setEditingUserId(null);
      setEditingUser(null);
      setUserFormData({ email: '', display_name: '', role: 'member' });
      setUserTokens([]);
      mutate('admin/users');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update user', 'error');
    }
  };

  const handleFetchUserTokens = async (userId: string) => {
    try {
      const result = await api.listUserApiTokens(userId);
      setUserTokens(result.tokens);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to fetch API tokens', 'error');
    }
  };

  const handleRevokeUserToken = async (tokenId: string) => {
    if (!editingUser) return;
    if (!confirm('Are you sure you want to revoke this API token?')) return;
    try {
      await api.revokeUserApiToken(editingUser.id, tokenId);
      showToast('API token revoked', 'success');
      await handleFetchUserTokens(editingUser.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to revoke token', 'error');
    }
  };

  const handleCreateToken = async () => {
    if (!editingUser) return;
    if (!createTokenData.name.trim()) {
      showToast('Token name is required', 'error');
      return;
    }
    try {
      const result = await api.createUserApiToken(
        editingUser.id,
        createTokenData.name,
        createTokenData.expiresInDays
      );
      setNewToken(result);
      showToast('API token created', 'success');
      setCreateTokenData({ name: '', expiresInDays: undefined });
      await handleFetchUserTokens(editingUser.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create token', 'error');
    }
  };

  const handleCreateUser = async () => {
    if (!userFormData.email) {
      showToast('Email is required', 'error');
      return;
    }
    try {
      await api.createUser(userFormData);
      showToast('User created successfully', 'success');
      setIsCreateUserOpen(false);
      setUserFormData({ email: '', display_name: '', role: 'member' });
      mutate('admin/users');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create user', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.deleteUser(userId);
      showToast('User deleted successfully', 'success');
      mutate('admin/users');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete user', 'error');
    }
  };

  // Group Management Handlers
  const handleCreateGroup = async () => {
    try {
      await api.createGroup(groupFormData);
      showToast('Group created successfully', 'success');
      setIsCreateGroupOpen(false);
      setGroupFormData({ name: '', description: '' });
      mutate('admin/groups');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create group', 'error');
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroup) return;
    try {
      await api.addGroupMember(selectedGroup, addMemberData.user_id);
      showToast('Member added to group', 'success');
      setIsAddMemberOpen(false);
      setAddMemberData({ user_id: '' });
      mutate(`admin/group/${selectedGroup}/members`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add member', 'error');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      await api.removeGroupMember(selectedGroup, userId);
      showToast('Member removed from group', 'success');
      mutate(`admin/group/${selectedGroup}/members`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  };

  // If editing a user, show the edit page instead
  if (editingUserId && editingUser) {
    return (
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            className={styles.btnSecondary}
            onClick={() => {
              setEditingUserId(null);
              setEditingUser(null);
              setUserFormData({ email: '', display_name: '', role: 'member' });
              setUserTokens([]);
            }}
            style={{ marginBottom: '1rem' }}
          >
            ← Back to Users
          </button>
          <h1>Edit User</h1>
          <p>{editingUser.display_name || editingUser.email || editingUser.id}</p>
        </motion.div>

        <motion.div
          className={styles.content}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className={styles.card}>
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Display Name</label>
                <input
                  type="text"
                  value={userFormData.display_name}
                  onChange={(e) => setUserFormData({ ...userFormData, display_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Role</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              {/* API Keys Section */}
              <div className={styles.formGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label>API Keys</label>
                  <button
                    className={styles.btnSmall}
                    onClick={() => setIsCreateTokenOpen(true)}
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    + Add Key
                  </button>
                </div>
                {userTokens && userTokens.length > 0 ? (
                  <div className={styles.tokenList}>
                    {userTokens.map((token: any) => (
                      <div key={token.id} className={styles.tokenItem}>
                        <div>
                          <div className={styles.tokenName}>{token.name}</div>
                          <div className={styles.tokenMeta}>
                            {token.token_prefix}...
                            {token.expires_at && (
                              <span className={styles.tokenExpiry}>
                                Expires: {new Date(token.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className={`${styles.btnSmall} ${styles.danger}`}
                          onClick={() => handleRevokeUserToken(token.id)}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>No API keys</div>
                )}
              </div>

              <div className={styles.formActions}>
                <button className={styles.btnPrimary} onClick={handleUpdateUser}>
                  Update
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => {
                    setEditingUserId(null);
                    setEditingUser(null);
                    setUserFormData({ email: '', display_name: '', role: 'member' });
                    setUserTokens([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Modals for edit user page */}
        <Modal isOpen={isCreateTokenOpen} onClose={() => setIsCreateTokenOpen(false)} title="Create API Key">
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label>Token Name *</label>
              <input
                type="text"
                value={createTokenData.name}
                onChange={(e) => setCreateTokenData({ ...createTokenData, name: e.target.value })}
                placeholder="E.g., CI/CD Pipeline"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Expires In (days)</label>
              <input
                type="number"
                value={createTokenData.expiresInDays || ''}
                onChange={(e) =>
                  setCreateTokenData({
                    ...createTokenData,
                    expiresInDays: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="Leave empty for no expiry"
                min="1"
              />
            </div>
            <div className={styles.formActions}>
              <button className={styles.btnPrimary} onClick={handleCreateToken}>
                Create
              </button>
              <button className={styles.btnSecondary} onClick={() => setIsCreateTokenOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={!!newToken} onClose={() => setNewToken(null)} title="API Key Created">
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label>Token Value (save this securely, you won't be able to see it again)</label>
              <input
                type="text"
                readOnly
                value={newToken?.token || ''}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  padding: '0.75rem',
                }}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Name</label>
              <input type="text" readOnly value={newToken?.name || ''} />
            </div>
            <div className={styles.formGroup}>
              <label>Token Prefix</label>
              <input type="text" readOnly value={newToken?.token_prefix + '...' || ''} />
            </div>
            {newToken?.expires_at && (
              <div className={styles.formGroup}>
                <label>Expires At</label>
                <input
                  type="text"
                  readOnly
                  value={new Date(newToken.expires_at).toLocaleDateString()}
                />
              </div>
            )}
            <div className={styles.formActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  navigator.clipboard.writeText(newToken?.token);
                  showToast('Token copied to clipboard', 'success');
                }}
              >
                Copy Token
              </button>
              <button
                className={styles.btnPrimary}
                onClick={() => {
                  setNewToken(null);
                  setIsCreateTokenOpen(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>Admin Panel</h1>
        <p>Manage users, groups, and permissions</p>
      </motion.div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mainTab === 'users' ? styles.active : ''}`}
          onClick={() => setMainTab('users')}
        >
          Users
        </button>
        <button
          className={`${styles.tab} ${mainTab === 'groups' ? styles.active : ''}`}
          onClick={() => setMainTab('groups')}
        >
          Groups
        </button>
      </div>

      {/* Users Tab */}
      {mainTab === 'users' && (
        <motion.div
          className={styles.content}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Users</h2>
              <button
                className={styles.btnPrimary}
                onClick={() => {
                  setUserFormData({ email: '', display_name: '', role: 'member' });
                  setIsCreateUserOpen(true);
                }}
              >
                + Create User
              </button>
            </div>
            {usersError && <div className={styles.error}>Failed to load users</div>}

            {users && users.length > 0 ? (
              <div className={styles.list}>
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={styles.item}
                    onClick={() => {
                      setEditingUser(u);
                      setUserFormData({
                        email: u.email || '',
                        display_name: u.display_name || '',
                        role: u.role as any,
                      });
                      handleFetchUserTokens(u.id);
                      setEditingUserId(u.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{u.display_name || u.email || u.id}</div>
                      <div className={styles.itemMeta}>
                        <span className={styles.role}>{u.role}</span>
                        <span className={styles.email}>{u.email}</span>
                      </div>
                    </div>
                    <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.btnSmall}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingUser(u);
                          setUserFormData({
                            email: u.email || '',
                            display_name: u.display_name || '',
                            role: u.role as any,
                          });
                          handleFetchUserTokens(u.id);
                          setEditingUserId(u.id);
                        }}
                      >
                        Edit
                      </button>
                      {u.id !== user?.id && (
                        <button
                          className={`${styles.btnSmall} ${styles.danger}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(u.id);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>No users found</div>
            )}
          </div>
        </motion.div>
      )}

      {/* Groups Tab */}
      {mainTab === 'groups' && (
        <motion.div
          className={styles.content}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className={styles.twoColumn}>
            {/* Groups List */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Groups</h2>
                <button
                  className={styles.btnPrimary}
                  onClick={() => setIsCreateGroupOpen(true)}
                >
                  + Create Group
                </button>
              </div>
              {groupsError && <div className={styles.error}>Failed to load groups</div>}

              {groups && groups.length > 0 ? (
                <div className={styles.list}>
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className={`${styles.item} ${selectedGroup === g.id ? styles.selected : ''}`}
                      onClick={() => setSelectedGroup(g.id)}
                    >
                      <div className={styles.itemInfo}>
                        <div className={styles.itemName}>
                          {g.name}
                          {g.is_system && <span className={styles.badge}>System</span>}
                        </div>
                        {g.description && <div className={styles.itemDesc}>{g.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>No groups found</div>
              )}
            </div>

            {/* Group Members */}
            {selectedGroup && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Members</h2>
                  <button
                    className={styles.btnPrimary}
                    onClick={() => setIsAddMemberOpen(true)}
                  >
                    + Add Member
                  </button>
                </div>

                {groupMembers && groupMembers.length > 0 ? (
                  <div className={styles.list}>
                    {groupMembers.map((member) => (
                      <div key={member.user_id} className={styles.item}>
                        <div className={styles.itemInfo}>
                          <div className={styles.itemName}>{member.user_id}</div>
                        </div>
                        <button
                          className={`${styles.btnSmall} ${styles.danger}`}
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>No members in this group</div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Modals */}
      <Modal isOpen={isCreateUserOpen} onClose={() => setIsCreateUserOpen(false)} title="Create User">
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label>Email *</label>
            <input
              type="email"
              value={userFormData.email}
              onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
              placeholder="user@example.com"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Display Name</label>
            <input
              type="text"
              value={userFormData.display_name}
              onChange={(e) => setUserFormData({ ...userFormData, display_name: e.target.value })}
              placeholder="John Doe"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Role</label>
            <select
              value={userFormData.role}
              onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className={styles.formActions}>
            <button className={styles.btnPrimary} onClick={handleCreateUser}>
              Create
            </button>
            <button className={styles.btnSecondary} onClick={() => setIsCreateUserOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isCreateGroupOpen} onClose={() => setIsCreateGroupOpen(false)} title="Create Group">
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label>Group Name *</label>
            <input
              type="text"
              value={groupFormData.name}
              onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
              placeholder="E.g., Developers, Testers"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea
              value={groupFormData.description}
              onChange={(e) =>
                setGroupFormData({ ...groupFormData, description: e.target.value })
              }
              placeholder="Optional description..."
              rows={3}
            />
          </div>
          <div className={styles.formActions}>
            <button className={styles.btnPrimary} onClick={handleCreateGroup}>
              Create
            </button>
            <button className={styles.btnSecondary} onClick={() => setIsCreateGroupOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Add Member to Group">
        <div className={styles.form}>
          {users && users.length > 0 ? (
            <>
              <div className={styles.formGroup}>
                <label>Select User</label>
                <div className={styles.userTable}>
                  {users
                    .filter((u) => !groupMembers?.some((m) => m.user_id === u.id))
                    .map((u) => (
                      <div
                        key={u.id}
                        className={`${styles.userRow} ${addMemberData.user_id === u.id ? styles.selected : ''}`}
                        onClick={() => setAddMemberData({ user_id: u.id })}
                      >
                        <div>
                          <div className={styles.userName}>
                            {u.display_name || u.email || u.id}
                          </div>
                          <div className={styles.userEmail}>{u.email}</div>
                        </div>
                        <div className={styles.userRole}>{u.role}</div>
                      </div>
                    ))}
                </div>
              </div>
              <div className={styles.formActions}>
                <button
                  className={styles.btnPrimary}
                  onClick={handleAddMember}
                  disabled={!addMemberData.user_id}
                >
                  Add Member
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => {
                    setIsAddMemberOpen(false);
                    setAddMemberData({ user_id: '' });
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className={styles.empty}>No users available</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
