import styles from './ui.module.css';

export type MemoryType = 'codebase' | 'session' | 'spec' | 'decision' | 'task' | 'general' | 'commit' | 'pr';

interface TypeBadgeProps {
  type: MemoryType;
  className?: string;
}

const typeLabels: Record<MemoryType, string> = {
  codebase: 'Code',
  session: 'Session',
  spec: 'Spec',
  decision: 'Decision',
  task: 'Task',
  general: 'Note',
  commit: 'Commit',
  pr: 'PR',
};

export function TypeBadge({ type, className = '' }: TypeBadgeProps) {
  return (
    <span className={`${styles.typeBadge} ${styles[type]} ${className}`}>
      {typeLabels[type] || type}
    </span>
  );
}
