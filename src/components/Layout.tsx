import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import useSWR from 'swr';
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
      { path: '/mcp', label: 'MCP Tester', icon: 'tool' },
      { path: '/settings', label: 'Settings', icon: 'settings' },
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
};

export function Layout() {
  const location = useLocation();
  const { isAuthenticated, clearAuth } = useAuth();
  const { selectedProjectId, selectProject } = useProject();

  const { data: status } = useSWR(
    'status',
    () => api.getStatus(),
    { refreshInterval: 5000 }
  );

  const { data: jobs } = useSWR(
    'jobs',
    api.getJobs,
    { refreshInterval: 5000 }
  );

  const jobCount = jobs?.filter(
    (j) => j.status === 'pending' || j.status === 'running'
  ).length || 0;

  return (
    <div className={styles.app}>
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
          <ProjectSelector
            value={selectedProjectId}
            onChange={selectProject}
            placeholder="Select a project..."
          />
        </div>

        <div className={styles.headerStatus}>
          <div className={styles.statusIndicator}>
            <span
              className={`${styles.statusDot} ${
                status?.status === 'healthy' ? styles.healthy : styles.warning
              }`}
            />
            <span>
              {status?.status === 'healthy'
                ? 'All systems operational'
                : 'Connecting...'}
            </span>
          </div>
          <div className={styles.statusIndicator}>
            <span style={{ color: 'var(--text-tertiary)' }}>
              v{status?.version || '0.1.0'}
            </span>
          </div>
          {isAuthenticated && (
            <button onClick={clearAuth} className={styles.logoutBtn}>
              Logout
            </button>
          )}
        </div>
      </header>

      {/* AI Providers Offline Warning Banner */}
      {status && (!status.llm?.available || !status.embeddings?.loaded) && (
        <div className={styles.warningBanner}>
          <div className={styles.warningContent}>
            <svg className={styles.warningIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className={styles.warningText}>
              <div className={styles.warningTitle}>AI Providers Offline</div>
              <div className={styles.warningMessage}>
                {!status.llm?.available && !status.embeddings?.loaded
                  ? 'LLM and embedding providers are not available.'
                  : !status.llm?.available
                  ? 'LLM provider is not available.'
                  : 'Embedding provider is not available.'}
                {status.jobs?.paused > 0 && ` ${status.jobs.paused} job${status.jobs.paused > 1 ? 's' : ''} paused.`}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Sidebar */}
      <nav className={styles.sidebar}>
        {navItems.map((section) => (
          <div key={section.section} className={styles.navSection}>
            <div className={styles.navLabel}>{section.section}</div>
            {section.items.map((item) => (
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
        ))}
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
