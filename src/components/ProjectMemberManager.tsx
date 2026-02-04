import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from './ToastContext';
import styles from './ProjectMemberManager.module.css';

interface ProjectMember {
  user_id: string;
  project_id: string;
  role: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
}

interface User {
  id: string;
  email?: string;
  display_name?: string;
  role?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface Props {
  projectId: string;
}

type MemberType = 'user' | 'group';

export function ProjectMemberManager({ projectId }: Props) {
  const { showToast } = useToast();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberType, setMemberType] = useState<MemberType>('user');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'viewer'>('viewer');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listProjectMembers(projectId);
      const membersList = response?.members || response || [];
      setMembers(Array.isArray(membersList) ? membersList : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load members';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await api.listUsers();
      const usersList = Array.isArray(response) ? response : response?.users || [];
      setUsers(usersList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      showToast(message, 'error');
    }
  }, [showToast]);

  const loadGroups = useCallback(async () => {
    try {
      const response = await api.listGroups();
      const groupsList = Array.isArray(response) ? response : response?.groups || [];
      setGroups(groupsList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load groups';
      showToast(message, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadMembers();
    loadUsers();
    loadGroups();
  }, [loadMembers, loadUsers, loadGroups]);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (memberType === 'user') {
      return users
        .filter(u => !members.some(m => m.user_id === u.id))
        .filter(u =>
          (u.display_name?.toLowerCase().includes(query) ||
           u.email?.toLowerCase().includes(query) ||
           u.id.toLowerCase().includes(query))
        );
    } else {
      return groups
        .filter(g => !members.some(m => m.user_id === g.id))
        .filter(g =>
          (g.name?.toLowerCase().includes(query) ||
           g.id.toLowerCase().includes(query))
        );
    }
  }, [searchQuery, memberType, users, groups, members]);

  const handleAddMember = async () => {
    if (!selectedMember) {
      showToast('Please select a user or group', 'error');
      return;
    }

    try {
      await api.addProjectMember(projectId, selectedMember, selectedRole);
      showToast(`${memberType === 'user' ? 'User' : 'Group'} added successfully`, 'success');
      setSelectedMember('');
      setSelectedRole('viewer');
      setSearchQuery('');
      setIsOpen(false);
      await loadMembers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add member', 'error');
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      await api.updateProjectMemberRole(projectId, memberId, newRole);
      showToast('Role updated', 'success');
      await loadMembers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the project?')) return;

    try {
      await api.removeProjectMember(projectId, memberId);
      showToast('Member removed', 'success');
      await loadMembers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Members</h2>
          <p className={styles.subtitle}>Manage who can access this project</p>
        </div>
        <button
          className={styles.addBtn}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {isOpen && (
        <div className={styles.addForm}>
          <div className={styles.typeSelector}>
            <button
              className={`${styles.typeOption} ${memberType === 'user' ? styles.active : ''}`}
              onClick={() => {
                setMemberType('user');
                setSelectedMember('');
                setSearchQuery('');
              }}
            >
              User
            </button>
            <button
              className={`${styles.typeOption} ${memberType === 'group' ? styles.active : ''}`}
              onClick={() => {
                setMemberType('group');
                setSelectedMember('');
                setSearchQuery('');
              }}
            >
              Group
            </button>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Select {memberType === 'user' ? 'User' : 'Group'}</label>
            <input
              type="text"
              placeholder={`Search ${memberType === 'user' ? 'users' : 'groups'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.input}
            />

            {filteredOptions.length > 0 && (
              <div className={styles.optionsList}>
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`${styles.option} ${selectedMember === option.id ? styles.selected : ''}`}
                    onClick={() => setSelectedMember(option.id)}
                  >
                    <div className={styles.optionContent}>
                      {memberType === 'user' ? (
                        <>
                          <div className={styles.optionName}>
                            {(option as User).display_name || (option as User).email || option.id}
                          </div>
                          {(option as User).email && (option as User).display_name && (
                            <div className={styles.optionEmail}>
                              {(option as User).email}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className={styles.optionName}>{(option as Group).name}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredOptions.length === 0 && (
              <div className={styles.empty}>
                {searchQuery ? 'No results found' : `All ${memberType === 'user' ? 'users' : 'groups'} are already members`}
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Role</label>
            <div className={styles.roleSelector}>
              <button
                className={`${styles.roleOption} ${selectedRole === 'viewer' ? styles.active : ''}`}
                onClick={() => setSelectedRole('viewer')}
              >
                <div className={styles.roleName}>Viewer</div>
                <div className={styles.roleDesc}>Read-only</div>
              </button>
              <button
                className={`${styles.roleOption} ${selectedRole === 'member' ? styles.active : ''}`}
                onClick={() => setSelectedRole('member')}
              >
                <div className={styles.roleName}>Member</div>
                <div className={styles.roleDesc}>Read & write</div>
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primaryBtn}
              onClick={handleAddMember}
              disabled={!selectedMember}
            >
              Add {memberType === 'user' ? 'User' : 'Group'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading members...</div>
      ) : members.length > 0 ? (
        <div className={styles.membersList}>
          {members.map((member) => (
            <div key={member.user_id} className={styles.memberCard}>
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>
                  {member.display_name || member.email || member.user_id}
                </div>
                {member.email && member.display_name && (
                  <div className={styles.memberEmail}>{member.email}</div>
                )}
              </div>
              <div className={styles.memberActions}>
                <select
                  className={styles.roleSelect}
                  value={member.role}
                  onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                </select>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemoveMember(member.user_id)}
                  title="Remove member"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyText}>No members yet</div>
          <button
            className={styles.primaryBtn}
            onClick={() => setIsOpen(true)}
          >
            Add your first member
          </button>
        </div>
      )}
    </div>
  );
}
