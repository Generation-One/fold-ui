import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Cookie utilities
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
}

interface ProjectState {
  selectedProjectId: string | null;

  // Actions
  selectProject: (projectId: string | null) => void;
  getSelectedProject: () => string | null;
}

export const useProject = create<ProjectState>()(
  persist(
    (set, get) => ({
      selectedProjectId: null,

      selectProject: (projectId: string | null) => {
        set({ selectedProjectId: projectId });
        if (projectId) {
          setCookie('fold-selected-project', projectId);
        } else {
          deleteCookie('fold-selected-project');
        }
      },

      getSelectedProject: () => {
        return get().selectedProjectId;
      },
    }),
    {
      name: 'fold-project',
      partialize: (state) => ({ selectedProjectId: state.selectedProjectId }),
      onRehydrateStorage: () => (state) => {
        // Try to load from cookie first, then fall back to localStorage
        if (state) {
          const cookieValue = getCookie('fold-selected-project');
          if (cookieValue) {
            state.selectedProjectId = cookieValue;
          }
        }
      },
    }
  )
);
