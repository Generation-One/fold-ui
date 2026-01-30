import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { api } from '../lib/api';
import type { GraphNode, GraphData, Project } from '../lib/api';
import { EmptyState, ProjectSelector, TypeBadge } from '../components/ui';
import type { MemoryType } from '../components/ui';
import styles from './Graph.module.css';

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const TYPE_COLORS: Record<string, string> = {
  codebase: '#00d4ff',
  session: '#a855f7',
  spec: '#ec4899',
  decision: '#f59e0b',
  task: '#10b981',
  general: '#8b8b9e',
};

export function Graph() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const [, forceUpdate] = useState({});

  // Projects are fetched by ProjectSelector, but we warm the cache here
  useSWR<Project[]>('projects', api.listProjects);

  const { data: graphData, isLoading } = useSWR<GraphData>(
    selectedProject ? ['graph', selectedProject] : null,
    () => api.getGraph(selectedProject!),
    { refreshInterval: 30000 }
  );

  // Initialize nodes with positions
  useEffect(() => {
    if (!graphData) {
      nodesRef.current = [];
      return;
    }

    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    nodesRef.current = graphData.nodes.map((node) => ({
      ...node,
      x: centerX + (Math.random() - 0.5) * 400,
      y: centerY + (Math.random() - 0.5) * 300,
      vx: 0,
      vy: 0,
    }));

    forceUpdate({});
  }, [graphData]);

  // Simple force simulation
  useEffect(() => {
    if (!graphData || nodesRef.current.length === 0) return;

    const simulate = () => {
      const nodes = nodesRef.current;
      const edges = graphData.edges;
      const width = 800;
      const height = 600;
      const centerX = width / 2;
      const centerY = height / 2;

      // Reset forces
      nodes.forEach((node) => {
        node.vx = 0;
        node.vy = 0;
      });

      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);

          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      edges.forEach((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.05 * edge.weight;

        source.vx += (dx / dist) * force;
        source.vy += (dy / dist) * force;
        target.vx -= (dx / dist) * force;
        target.vy -= (dy / dist) * force;
      });

      // Center gravity
      nodes.forEach((node) => {
        node.vx += (centerX - node.x) * 0.01;
        node.vy += (centerY - node.y) * 0.01;
      });

      // Apply velocity with damping
      nodes.forEach((node) => {
        node.x += node.vx * 0.1;
        node.y += node.vy * 0.1;
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(50, Math.min(height - 50, node.y));
      });

      forceUpdate({});
    };

    const interval = setInterval(simulate, 50);
    return () => clearInterval(interval);
  }, [graphData]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'line') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const nodes = nodesRef.current;
  const edges = graphData?.edges || [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Knowledge Graph</h1>
          <p className={styles.pageSubtitle}>Visualize memory relationships</p>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <ProjectSelector
          value={selectedProject}
          onChange={(id) => {
            setSelectedProject(id);
            setSelectedNode(null);
            setPan({ x: 0, y: 0 });
            setZoom(1);
          }}
          placeholder="Select a project..."
        />
      </div>

      {/* Graph Container */}
      <div className={styles.graphContainer}>
        {!selectedProject ? (
          <div className={styles.emptyWrapper}>
            <EmptyState
              icon={
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="19" cy="5" r="2" />
                  <circle cx="5" cy="19" r="2" />
                  <path d="M14.5 10L17 7M9.5 14L7 17" />
                </svg>
              }
              title="Select a project"
              description="Choose a project to visualize its memory graph"
            />
          </div>
        ) : isLoading ? (
          <div className={styles.loading}>Loading graph...</div>
        ) : nodes.length === 0 ? (
          <div className={styles.emptyWrapper}>
            <EmptyState
              icon={
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="19" cy="5" r="2" />
                  <circle cx="5" cy="19" r="2" />
                  <path d="M14.5 10L17 7M9.5 14L7 17" />
                </svg>
              }
              title="No graph data"
              description="This project doesn't have enough memories to build a graph"
            />
          </div>
        ) : (
          <>
            <svg
              ref={svgRef}
              className={styles.graphCanvas}
              viewBox="0 0 800 600"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {edges.map((edge, i) => {
                  const source = nodeMap.get(edge.source);
                  const target = nodeMap.get(edge.target);
                  if (!source || !target) return null;
                  return (
                    <line
                      key={i}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="rgba(139, 139, 158, 0.3)"
                      strokeWidth={1 + edge.weight}
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedNode(node)}
                  >
                    <circle
                      r={12}
                      fill={TYPE_COLORS[node.type] || TYPE_COLORS.general}
                      opacity={selectedNode?.id === node.id ? 1 : 0.8}
                      stroke={selectedNode?.id === node.id ? '#fff' : 'transparent'}
                      strokeWidth={2}
                    />
                    <title>{node.label || node.content.slice(0, 50)}</title>
                  </g>
                ))}
              </g>
            </svg>

            {/* Zoom Controls */}
            <div className={styles.zoomControls}>
              <button
                className={styles.zoomBtn}
                onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button
                className={styles.zoomBtn}
                onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <button
                className={styles.zoomBtn}
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0" />
                  <path d="M12 8v4l2 2" />
                </svg>
              </button>
            </div>

            {/* Legend */}
            <div className={styles.legend}>
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles[type]}`} style={{ background: color }} />
                  <span>{type}</span>
                </div>
              ))}
            </div>

            {/* Node Detail Panel */}
            {selectedNode && (
              <div className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                  <span className={styles.detailTitle}>Memory Details</span>
                  <button className={styles.closeBtn} onClick={() => setSelectedNode(null)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className={styles.detailContent}>
                  <div className={styles.detailType}>
                    <TypeBadge type={selectedNode.type as MemoryType} />
                  </div>
                  <div className={styles.detailText}>{selectedNode.content}</div>
                  <div className={styles.detailMeta}>
                    Created: {formatDate(selectedNode.created_at)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
