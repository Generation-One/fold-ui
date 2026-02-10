import { type ReactNode, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR, { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useProject } from '../stores/project';
import { ProjectSelector } from './ui/ProjectSelector';
import styles from './Layout.module.css';

const navItems = [
  {
    section: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: 'grid' },
      { path: '/search', label: 'Search', icon: 'search' },
    ],
  },
  {
    section: 'Memory',
    items: [
      { path: '/projects', label: 'Projects', icon: 'folder' },
      { path: '/memories', label: 'Memories', icon: 'layers' },
    ],
  },
  {
    section: 'System',
    items: [
      { path: '/jobs', label: 'Jobs', icon: 'list' },
      { path: '/logs', label: 'Logs', icon: 'terminal', adminOnly: true },
      { path: '/mcp', label: 'MCP Tester', icon: 'tool' },
      { path: '/settings', label: 'Settings', icon: 'settings' },
      { path: '/admin', label: 'Users', icon: 'users', adminOnly: true },
    ],
  },
];

const icons: Record<string, ReactNode> = {
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  tool: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
};

export function Layout() {
  const location = useLocation();
  const { isAuthenticated, clearAuth, user } = useAuth();
  const { selectedProjectId, selectProject } = useProject();
  const { mutate } = useSWRConfig();

  // Track previous auth and status states to detect transitions
  const prevAuthRef = useRef<boolean | null>(null);
  const prevStatusRef = useRef<boolean | null>(null);

  const { data: status, error: statusError } = useSWR(
    'status',
    () => api.getStatus(),
    { refreshInterval: 5000 }
  );

  // Determine if system is offline or unreachable
  const isSystemOffline = !status || status.status !== 'healthy' || statusError;

  const { data: jobs } = useSWR(
    'jobs',
    api.getJobs,
    { refreshInterval: 5000 }
  );

  const jobCount = jobs?.filter(
    (j) => j.status === 'pending' || j.status === 'running'
  ).length || 0;

  // Refresh sidebar data when auth or system status changes
  useEffect(() => {
    const wasAuthenticated = prevAuthRef.current;
    const wasOnline = prevStatusRef.current;

    // Detect auth state transition
    const authChanged = wasAuthenticated !== null && wasAuthenticated !== isAuthenticated;
    // Detect system status transition (offline <-> online)
    const statusChanged = wasOnline !== null && wasOnline !== !isSystemOffline;

    if (authChanged || statusChanged) {
      // Revalidate sidebar-related caches
      mutate('projects');
      mutate('jobs');
    }

    // Update refs for next comparison
    prevAuthRef.current = isAuthenticated;
    prevStatusRef.current = !isSystemOffline;
  }, [isAuthenticated, isSystemOffline, mutate]);

  return (
    <div className={styles.app}>
      {/* System Offline Banner */}
      {isSystemOffline && (
        <motion.div
          className={`${styles.warningBanner} ${styles.offlineBanner}`}
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.warningContent}>
            <div className={styles.offlineIconWrapper}>
              <svg className={styles.offlineIcon} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className={styles.warningText}>
              <span className={styles.warningTitle}>System Offline</span>
              <span className={styles.warningMessage}>
                — {statusError
                  ? statusError instanceof Error && statusError.message.includes('401')
                    ? 'Authentication failed - check your API token'
                    : 'Cannot reach the system - check your connection'
                  : status?.status === 'unhealthy'
                  ? 'The system is currently unavailable'
                  : 'The system is operating in degraded mode'}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* AI Providers Offline Warning Banner */}
      {status && !statusError && status.status === 'healthy' && (!status.llm?.available || !status.embeddings?.loaded) && (
        <div className={styles.warningBanner}>
          <div className={styles.warningContent}>
            <svg className={styles.warningIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className={styles.warningText}>
              <span className={styles.warningTitle}>AI Providers Offline</span>
              <span className={styles.warningMessage}>
                — {!status.llm?.available && !status.embeddings?.loaded
                  ? 'LLM and embedding providers not available'
                  : !status.llm?.available
                  ? 'LLM provider not available'
                  : 'Embedding provider not available'}
                {status.jobs?.paused > 0 && ` · ${status.jobs.paused} job${status.jobs.paused > 1 ? 's' : ''} paused`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <div className={styles.logoMark}>
            <svg viewBox="0 0 36 36" fill="none">
              <defs>
                <linearGradient id="holoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d4ff" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ff00aa" />
                </linearGradient>
              </defs>
              <path
                className={styles.foldShape}
                d="M18 4L32 12V24L18 32L4 24V12L18 4Z"
              />
              <path className={styles.foldShape} d="M18 4V18L4 12" opacity="0.5" />
              <path className={styles.foldShape} d="M18 4V18L32 12" opacity="0.5" />
              <path className={styles.foldShape} d="M18 18V32L4 24" opacity="0.5" />
              <path className={styles.foldShape} d="M18 18V32L32 24" opacity="0.5" />
            </svg>
          </div>
          <div>
            <div className={styles.logoText}>Fold</div>
            <div className={styles.logoSubtitle}>Holographic Memory</div>
          </div>
        </Link>

        <div className={styles.headerCenter}>
          {isAuthenticated && (
            <ProjectSelector
              value={selectedProjectId}
              onChange={selectProject}
              placeholder="Select a project..."
            />
          )}
        </div>

        <div className={styles.headerStatus}>
          <div className={styles.statusIndicator}>
            <span
              className={`${styles.statusDot} ${
                status?.status === 'healthy' && status?.llm?.available && status?.embeddings?.loaded
                  ? styles.healthy
                  : styles.warning
              }`}
            />
            <span>
              {!status
                ? 'Connecting...'
                : status.status === 'healthy' && status.llm?.available && status.embeddings?.loaded
                ? 'All systems operational'
                : 'Systems degraded'}
            </span>
          </div>
          <div className={styles.statusIndicator} style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>
              srv v{status?.version || '0.1.0'}
            </span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>
              ui v{__APP_VERSION__}
            </span>
          </div>
          {isAuthenticated && (
            <button onClick={clearAuth} className={styles.logoutBtn}>
              Logout
            </button>
          )}
        </div>
      </header>


      {/* Sidebar */}
      <nav className={styles.sidebar}>
        {navItems.map((section) => {
          // Filter items based on authentication, admin access, and project selection
          const visibleItems = section.items.filter((item) => {
            // Skip admin-only items if user is not admin
            if (item.adminOnly && !user?.roles?.includes('admin')) {
              return false;
            }
            // Skip Search and Memories if no project is selected
            if ((item.path === '/search' || item.path === '/memories') && !selectedProjectId) {
              return false;
            }
            // When not authenticated, only show Settings
            if (!isAuthenticated && item.path !== '/settings') {
              return false;
            }
            return true;
          });

          // Skip section if no visible items
          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div key={section.section} className={styles.navSection}>
              <div className={styles.navLabel}>{section.section}</div>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `${styles.navItem} ${isActive ? styles.active : ''}`
                  }
                  end={item.path === '/'}
                >
                  <span className={styles.navIcon}>{icons[item.icon]}</span>
                  {item.label}
                  {item.path === '/jobs' && jobCount > 0 && (
                    <span className={styles.navBadge}>{jobCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className={styles.main}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
