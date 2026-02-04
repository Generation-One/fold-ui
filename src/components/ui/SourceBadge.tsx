import type { JSX } from 'react';
import styles from './ui.module.css';
import type { MemorySource } from '../../lib/api';

interface SourceBadgeProps {
  source: MemorySource;
  className?: string;
}

const sourceLabels: Record<MemorySource, string> = {
  file: 'File',
  manual: 'Manual',
  generated: 'Generated',
};

const sourceIcons: Record<MemorySource, JSX.Element> = {
  file: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  manual: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
    </svg>
  ),
  generated: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
};

export function SourceBadge({ source, className = '' }: SourceBadgeProps) {
  return (
    <span className={`${styles.sourceBadge} ${styles[source]} ${className}`}>
      {sourceIcons[source]}
      {sourceLabels[source]}
    </span>
  );
}

// Re-export for backwards compatibility during transition
export type { MemorySource };
