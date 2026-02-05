# Fold UI

A holographic memory system interface for the [Fold](https://github.com/Generation-One/fold) semantic memory server.

![Fold UI](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple)

## Features

- **Dashboard** - System overview with status, jobs, and quick actions
- **Projects** - Create and manage memory projects
- **Memories** - Browse, create, and search semantic memories
- **Search** - Semantic search across project memories
- **Graph** - Interactive visualization of memory relationships
- **Jobs** - Monitor background indexing and processing jobs
- **MCP Tester** - Test MCP tools via JSON-RPC 2.0 protocol
- **Settings** - Authentication and API configuration

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and builds
- **Zustand** for state management with persistence
- **SWR** for data fetching with caching
- **Framer Motion** for animations
- **CSS Modules** with holographic design system

## Getting Started

### Prerequisites

- A running [Fold server](https://github.com/Generation-One/fold) instance

### Option A: Pre-built Image (Recommended)

Pre-built images are available from GitHub Container Registry. This is the fastest way to get started.

```bash
docker pull ghcr.io/generation-one/fold-ui:latest
```

Run with your Fold API URL:

```bash
docker run -d -p 80:80 -e VITE_API_URL=https://your-fold-server.com ghcr.io/generation-one/fold-ui:latest
```

Or use docker-compose:

```yaml
# docker-compose.yml
services:
  fold-ui:
    image: ghcr.io/generation-one/fold-ui:latest
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=https://your-fold-server.com
```

The `VITE_API_URL` is configured at container startup (runtime), so you can change it without rebuilding the image.

### Option B: Build from Source

```bash
git clone https://github.com/Generation-One/fold-ui.git
cd fold-ui
docker compose up -d --build
```

### Option B: Local Development

Prerequisites: Node.js 18+

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to point to your Fold server:

```env
VITE_API_URL=http://localhost:8765
```

Start development server:

```bash
npm run dev
```

Opens at http://localhost:5174

### Build

```bash
npm run build
```

Output in `dist/` folder.

## Authentication

1. Go to **Settings**
2. Either:
   - Enter an existing API token, or
   - Use the Bootstrap flow with your server's `ADMIN_BOOTSTRAP_TOKEN`
3. Click **Save Token**

The token is persisted in localStorage and automatically restored on page reload.

## MCP Tester

The MCP Tester page allows you to:

1. Connect to any MCP server endpoint via JSON-RPC 2.0
2. Browse available tools with their input schemas
3. Execute tools with form-based parameter input (supports enums, arrays, objects)
4. View formatted responses with JSON syntax highlighting
5. Collapsible raw JSON view for debugging

## Design System

The UI uses a "Crystalline Holographic" design with:

- Dark surfaces with subtle transparency
- Cyan/violet holographic accent gradients
- JetBrains Mono for code, Instrument Serif for titles
- Smooth Framer Motion transitions
- Responsive grid layouts

### CSS Variables

Key theme variables defined in `index.css`:

```css
--background: #0a0a0f
--surface: rgba(20, 20, 30, 0.8)
--holo-cyan: #00d4ff
--holo-violet: #a855f7
--gradient-holo: linear-gradient(135deg, #00d4ff, #a855f7)
```

## Project Structure

```
src/
├── components/
│   ├── Layout.tsx          # App shell with sidebar
│   └── ui/                  # Shared UI components
├── lib/
│   └── api.ts              # API client and types
├── pages/
│   ├── Dashboard.tsx
│   ├── Projects.tsx
│   ├── Memories.tsx
│   ├── Search.tsx
│   ├── Graph.tsx
│   ├── Jobs.tsx
│   ├── McpTester.tsx
│   └── Settings.tsx
├── stores/
│   └── auth.ts             # Zustand auth store
├── App.tsx
└── main.tsx
```

## License

MIT
