import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../stores/auth';
import { useSSE, type JobLogEvent } from '../hooks/useSSE';
import { useSSEStore } from '../stores/sse';
import styles from './Logs.module.css';

type LogLevel = 'all' | 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: LogLevel[] = ['all', 'debug', 'info', 'warn', 'error'];
const MAX_LOGS = 1000;

// Patterns to filter out noisy logs (e.g. status update requests, polling)
const NOISE_PATTERNS = [
  /GET \/health/i,
  /GET \/api\/health/i,
  /GET \/status/i,
  /GET \/api\/status/i,
  /\/status\/jobs/i,
  /health.*check/i,
  /status.*update/i,
  /started processing request/i,
  /finished processing request/i,
  /trace::on_request/i,
  /trace::on_response/i,
];

function isNoisyLog(message: string): boolean {
  return NOISE_PATTERNS.some(pattern => pattern.test(message));
}

export function Logs() {
  const { user } = useAuth();
  // Seed with whatever the background buffer has already collected
  const [logs, setLogs] = useState<JobLogEvent[]>(() => useSSEStore.getState().logBuffer);
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [jobFilter, setJobFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setPaused] = useState(false);
  const [filterNoise, setFilterNoise] = useState(true);
  const sseStatus = useSSEStore((s) => s.connectionStatus);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Handle new log events from SSE
  const handleJobLog = useCallback((event: JobLogEvent) => {
    setLogs(prev => {
      const newLogs = [...prev, event];
      if (newLogs.length > MAX_LOGS) {
        return newLogs.slice(-MAX_LOGS);
      }
      return newLogs;
    });
  }, []);

  // SSE connection (connection status comes from the SSE store)
  useSSE({
    enabled: !isPaused,
    onJobLog: handleJobLog,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current && logsContainerRef.current) {
      // Mark that we're auto-scrolling so the scroll handler ignores this scroll event
      isAutoScrollingRef.current = true;
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      // Reset the flag after a short delay (smooth scroll takes time)
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }
  }, [logs, autoScroll]);

  // Detect manual scroll UP to disable auto-scroll
  // Only disable if user scrolls UP (away from bottom), not when auto-scroll happens
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current) return;

    // Ignore scroll events caused by auto-scroll
    if (isAutoScrollingRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    // Only disable auto-scroll if user scrolled UP (scrollTop decreased)
    // This prevents disabling when new content pushes the scroll position
    if (scrollTop < lastScrollTopRef.current && !isAtBottom && autoScroll) {
      setAutoScroll(false);
    }

    lastScrollTopRef.current = scrollTop;
  }, [autoScroll]);

  // Filter logs based on noise, level, job ID, and search text
  const filteredLogs = logs.filter(log => {
    // Noise filter
    if (filterNoise && isNoisyLog(log.message)) {
      return false;
    }

    // Level filter
    if (levelFilter !== 'all' && log.level !== levelFilter) {
      return false;
    }

    // Job ID filter
    if (jobFilter && !log.job_id.toLowerCase().includes(jobFilter.toLowerCase())) {
      return false;
    }

    // Search text filter
    if (searchFilter && !log.message.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Get unique job IDs for the dropdown
  const uniqueJobIds = [...new Set(logs.map(log => log.job_id))];

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  // Clear all logs
  const handleClear = () => {
    setLogs([]);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    setAutoScroll(true);
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check if user is admin
  const isAdmin = user?.roles?.includes('admin');

  if (!isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={styles.accessDenied}
      >
        <div className={styles.accessDeniedIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h2>Access Denied</h2>
        <p>You must be an administrator to view system logs.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>System Logs</h1>
          <p className={styles.pageSubtitle}>Real-time job logs via SSE</p>
        </div>
        <div className={styles.headerRight}>
          <div className={`${styles.connectionStatus} ${styles[sseStatus]}`}>
            <span className={styles.statusDot} />
            {sseStatus === 'connected'
              ? 'Connected'
              : sseStatus === 'reconnecting'
              ? 'Reconnecting'
              : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          {/* Level Filter */}
          <div className={styles.filterGroup}>
            <label>Level</label>
            <div className={styles.levelFilters}>
              {LOG_LEVELS.map(level => (
                <button
                  key={level}
                  className={`${styles.levelChip} ${levelFilter === level ? styles.active : ''} ${styles[level]}`}
                  onClick={() => setLevelFilter(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Job Filter */}
          <div className={styles.filterGroup}>
            <label>Job</label>
            <select
              className={styles.select}
              value={jobFilter}
              onChange={e => setJobFilter(e.target.value)}
            >
              <option value="">All Jobs</option>
              {uniqueJobIds.map(jobId => (
                <option key={jobId} value={jobId}>
                  {jobId.slice(0, 8)}...
                </option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <div className={styles.filterGroup}>
            <label>Search</label>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Filter by message..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.controlsRight}>
          {/* Noise Filter Toggle */}
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={filterNoise}
              onChange={e => setFilterNoise(e.target.checked)}
            />
            <span>Hide noise</span>
          </label>

          {/* Auto-scroll Toggle */}
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
            <span>Auto-scroll</span>
          </label>

          {/* Pause/Resume */}
          <button
            className={`${styles.controlBtn} ${isPaused ? styles.paused : ''}`}
            onClick={() => setPaused(!isPaused)}
          >
            {isPaused ? (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Resume
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Pause
              </>
            )}
          </button>

          {/* Clear */}
          <button className={styles.controlBtn} onClick={handleClear}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Clear
          </button>

          {/* Scroll to Bottom */}
          {!autoScroll && (
            <button className={styles.controlBtn} onClick={scrollToBottom}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              Bottom
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        <span className={styles.statItem}>
          <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> logs
        </span>
        <span className={styles.statItem}>
          <span className={`${styles.levelDot} ${styles.error}`} />
          {logs.filter(l => l.level === 'error').length} errors
        </span>
        <span className={styles.statItem}>
          <span className={`${styles.levelDot} ${styles.warn}`} />
          {logs.filter(l => l.level === 'warn').length} warnings
        </span>
      </div>

      {/* Log Output */}
      <div
        ref={logsContainerRef}
        className={styles.logsContainer}
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
            <p>{isPaused ? 'Log stream paused' : 'Waiting for logs...'}</p>
            <span>Job logs will appear here in real-time</span>
          </div>
        ) : (
          <div className={styles.logsList}>
            {filteredLogs.map((log, index) => (
              <div
                key={`${log.job_id}-${log.timestamp}-${index}`}
                className={`${styles.logEntry} ${styles[log.level]}`}
              >
                <span className={styles.logTime}>{formatTime(log.timestamp)}</span>
                <span className={`${styles.logLevel} ${styles[log.level]}`}>{log.level.toUpperCase()}</span>
                <span className={styles.logJobId}>[{log.job_id.slice(0, 8)}]</span>
                {log.project_name && (
                  <span className={styles.logProject}>{log.project_name}</span>
                )}
                <span className={styles.logMessage}>{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
