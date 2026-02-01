import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Memories } from './pages/Memories';
import { Search } from './pages/Search';
import { Jobs } from './pages/Jobs';
import { Graph } from './pages/Graph';
import { McpTester } from './pages/McpTester';
import { Settings } from './pages/Settings';
import { ToastProvider } from './components/Toast';
import { useAuth } from './stores/auth';
import { api } from './lib/api';

function App() {
  const { token, fetchUser } = useAuth();

  // Sync token to api module whenever it changes (including after hydration)
  useEffect(() => {
    api.setToken(token);
  }, [token]);

  // Attempt to fetch user on mount if we have a token
  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token, fetchUser]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<Search />} />
            <Route path="projects" element={<Projects />} />
            <Route path="memories" element={<Memories />} />
            <Route path="graph" element={<Graph />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="mcp" element={<McpTester />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
