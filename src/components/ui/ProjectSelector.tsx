import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { api } from '../../lib/api';
import type { Project } from '../../lib/api';
import styles from './ui.module.css';

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  placeholder?: string;
}

export function ProjectSelector({ value, onChange, placeholder = 'Select project...' }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: projects } = useSWR<Project[]>('projects', api.listProjects);

  const selectedProject = projects?.find((p) => p.id === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.projectSelector} ref={ref}>
      <button
        className={styles.projectSelectorTrigger}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className={selectedProject ? styles.projectSelectorValue : styles.projectSelectorPlaceholder}>
          {selectedProject?.name || placeholder}
        </span>
        <svg
          className={`${styles.projectSelectorChevron} ${isOpen ? styles.open : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.projectSelectorDropdown}>
          {projects?.length === 0 ? (
            <div className={styles.projectSelectorEmpty}>No projects found</div>
          ) : (
            <>
              {value && (
                <button
                  className={styles.projectSelectorOption}
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                >
                  <span className={styles.projectSelectorPlaceholder}>All projects</span>
                </button>
              )}
              {projects?.map((project) => (
                <button
                  key={project.id}
                  className={`${styles.projectSelectorOption} ${project.id === value ? styles.selected : ''}`}
                  onClick={() => {
                    onChange(project.id);
                    setIsOpen(false);
                  }}
                >
                  <span>{project.name}</span>
                  {project.slug && (
                    <span className={styles.projectSelectorSlug}>{project.slug}</span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
