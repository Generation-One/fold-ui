import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { JSONRPCClient } from 'json-rpc-2.0';
import { useAuth } from '../stores/auth';
import styles from './McpTester.module.css';

interface McpToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: { type: string };
}

interface McpTool {
  name: string;
  description?: string;
  input_schema?: {
    type: string;
    properties?: Record<string, McpToolProperty>;
    required?: string[];
  };
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function McpTester() {
  const { token } = useAuth();
  const [mcpUrl, setMcpUrl] = useState(
    () => localStorage.getItem('mcp_url') || 'http://localhost:8765/mcp'
  );
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<{ success: boolean; data: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Array<{ type: 'send' | 'recv' | 'info' | 'error'; message: string; time: Date }>>([]);

  const clientRef = useRef<JSONRPCClient | null>(null);

  const addLog = useCallback((type: 'send' | 'recv' | 'info' | 'error', message: string) => {
    setLogs([{ type, message, time: new Date() }]);
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    addLog('info', `Connecting to ${mcpUrl}`);
    localStorage.setItem('mcp_url', mcpUrl);

    try {
      // Create JSON-RPC client - must call client.receive() to resolve pending requests
      const client: JSONRPCClient = new JSONRPCClient(async (jsonRPCRequest) => {
        addLog('send', JSON.stringify(jsonRPCRequest, null, 2));

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(mcpUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(jsonRPCRequest),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const jsonRPCResponse = await response.json();
        addLog('recv', JSON.stringify(jsonRPCResponse, null, 2));

        // Must call receive() to resolve the pending request promise
        client.receive(jsonRPCResponse);
      });

      clientRef.current = client;

      // Initialize the MCP connection
      const initResult = await client.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'fold-ui', version: '1.0.0' },
      });

      addLog('info', `Server: ${JSON.stringify(initResult)}`);

      // Send initialized notification
      client.notify('notifications/initialized', undefined);
      addLog('info', 'Sent initialized notification');

      // Get tools list
      const toolsResult = await client.request('tools/list', undefined) as { tools: McpTool[] };
      setTools(toolsResult.tools || []);
      addLog('info', `Loaded ${toolsResult.tools?.length || 0} tools`);

      setStatus('connected');
    } catch (err) {
      setStatus('error');
      addLog('error', `Connection failed: ${err instanceof Error ? err.message : err}`);
      clientRef.current = null;
    }
  }, [mcpUrl, token, addLog]);

  const disconnect = useCallback(() => {
    clientRef.current = null;
    setStatus('disconnected');
    setTools([]);
    setSelectedTool(null);
    addLog('info', 'Disconnected');
  }, [addLog]);

  const handleToolSelect = (tool: McpTool) => {
    setSelectedTool(tool);
    setParams({});
    setResponse(null);
  };

  const handleParamChange = (name: string, value: string) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleExecute = async () => {
    if (!selectedTool || !clientRef.current) return;

    setLoading(true);
    setResponse(null);

    try {
      // Build arguments, parsing JSON for objects/arrays
      const args: Record<string, unknown> = {};
      const properties = selectedTool.input_schema?.properties || {};

      for (const [name, value] of Object.entries(params)) {
        if (value === '') continue;
        const propType = properties[name]?.type;

        if (propType === 'object' || propType === 'array') {
          try {
            args[name] = JSON.parse(value);
          } catch {
            args[name] = value;
          }
        } else if (propType === 'integer' || propType === 'number') {
          args[name] = Number(value);
        } else if (propType === 'boolean') {
          args[name] = value === 'true';
        } else {
          args[name] = value;
        }
      }

      const result = await clientRef.current.request('tools/call', {
        name: selectedTool.name,
        arguments: args,
      });

      setResponse({ success: true, data: result });
    } catch (err) {
      setResponse({
        success: false,
        data: { error: err instanceof Error ? err.message : 'Request failed' },
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-connect on mount if token is available
  useEffect(() => {
    if (token && status === 'disconnected') {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Only run on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current = null;
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Syntax highlight JSON
  const highlightJson = (json: unknown): React.ReactNode => {
    const str = JSON.stringify(json, null, 2);
    const parts: React.ReactNode[] = [];
    let key = 0;

    // Regex to match JSON tokens
    const regex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}\[\],:])/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      // Add any whitespace before this match
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index));
      }

      if (match[1]) {
        // Key (property name)
        parts.push(
          <span key={key++} className={styles.jsonKey}>{match[1]}</span>,
          <span key={key++} className={styles.jsonPunct}>:</span>
        );
      } else if (match[2]) {
        // String value
        parts.push(<span key={key++} className={styles.jsonString}>{match[2]}</span>);
      } else if (match[3]) {
        // Number
        parts.push(<span key={key++} className={styles.jsonNumber}>{match[3]}</span>);
      } else if (match[4]) {
        // Boolean or null
        parts.push(<span key={key++} className={styles.jsonBool}>{match[4]}</span>);
      } else if (match[5]) {
        // Punctuation
        parts.push(<span key={key++} className={styles.jsonPunct}>{match[5]}</span>);
      }

      lastIndex = regex.lastIndex;
    }

    // Add any remaining text
    if (lastIndex < str.length) {
      parts.push(str.slice(lastIndex));
    }

    return parts;
  };

  // Extract and render MCP text content with proper formatting
  const renderMcpResponse = (data: unknown): React.ReactNode => {
    // Check if this is an MCP content response
    if (data && typeof data === 'object' && 'content' in data) {
      const content = (data as { content: Array<{ type: string; text?: string }> }).content;
      if (Array.isArray(content)) {
        const textParts = content
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text);

        if (textParts.length > 0) {
          return (
            <div className={styles.mcpContent}>
              <div className={styles.textContent}>
                {textParts.map((text, i) => (
                  <pre key={i} className={styles.formattedText}>{text}</pre>
                ))}
              </div>
              <details className={styles.rawJson}>
                <summary>Raw JSON</summary>
                <pre className={styles.responseCode}>{highlightJson(data)}</pre>
              </details>
            </div>
          );
        }
      }
    }
    // Fallback to syntax-highlighted JSON
    return <pre className={styles.responseCode}>{highlightJson(data)}</pre>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>MCP Tester</h1>
        <p className={styles.pageSubtitle}>Connect and test MCP tools via JSON-RPC 2.0</p>
      </div>

      {/* Connection Bar */}
      <div className={styles.connectionBar}>
        <div className={`${styles.tokenIndicator} ${token ? styles.hasToken : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span>{token ? 'Token set' : 'No token'}</span>
        </div>
        <input
          type="text"
          className={styles.urlInput}
          value={mcpUrl}
          onChange={(e) => setMcpUrl(e.target.value)}
          placeholder="MCP endpoint URL (e.g., http://localhost:8765/mcp)"
          disabled={status === 'connected' || status === 'connecting'}
        />
        {status === 'connected' ? (
          <button className={`${styles.connectBtn} ${styles.disconnect}`} onClick={disconnect}>
            Disconnect
          </button>
        ) : (
          <button
            className={styles.connectBtn}
            onClick={connect}
            disabled={status === 'connecting' || !token}
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </button>
        )}
        <div className={`${styles.statusIndicator} ${styles[status]}`}>
          <span className={styles.statusDot} />
          <span>{status}</span>
        </div>
      </div>

      <div className={styles.container}>
        {/* Tools Panel */}
        <div className={styles.toolsPanel}>
          <div className={styles.toolsPanelHeader}>
            Tools ({tools.length})
          </div>
          <div className={styles.toolsList}>
            {tools.length === 0 ? (
              <div className={styles.emptyTools}>
                {status === 'connected' ? 'No tools available' : 'Connect to load tools'}
              </div>
            ) : (
              tools.map((tool) => (
                <button
                  key={tool.name}
                  className={`${styles.toolItem} ${selectedTool?.name === tool.name ? styles.active : ''}`}
                  onClick={() => handleToolSelect(tool)}
                >
                  <svg className={styles.toolIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                  </svg>
                  <span className={styles.toolName}>{tool.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Panel */}
        <div className={styles.mainPanel}>
          {selectedTool ? (
            <>
              {/* Tool Details */}
              <div className={styles.toolDetails}>
                <div className={styles.toolHeader}>
                  <h2 className={styles.toolTitle}>{selectedTool.name}</h2>
                </div>
                {selectedTool.description && (
                  <p className={styles.toolDescription}>{selectedTool.description}</p>
                )}

                <div className={styles.paramsForm}>
                  {!selectedTool.input_schema?.properties || Object.keys(selectedTool.input_schema.properties).length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      This tool has no parameters.
                    </p>
                  ) : (
                    Object.entries(selectedTool.input_schema.properties).map(([name, prop]) => (
                      <div key={name} className={styles.paramGroup}>
                        <label className={styles.paramLabel}>
                          <span className={styles.paramName}>{name}</span>
                          {selectedTool.input_schema?.required?.includes(name) && (
                            <span className={styles.paramRequired}>required</span>
                          )}
                          <span className={styles.paramType}>{prop.type}</span>
                          {prop.default !== undefined && (
                            <span className={styles.paramDefault}>default: {String(prop.default)}</span>
                          )}
                        </label>
                        {prop.enum ? (
                          <select
                            className={styles.paramInput}
                            value={params[name] || ''}
                            onChange={(e) => handleParamChange(name, e.target.value)}
                          >
                            <option value="">{prop.description || `Select ${name}`}</option>
                            {prop.enum.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : prop.type === 'object' || prop.type === 'array' ? (
                          <textarea
                            className={`${styles.paramInput} ${styles.paramTextarea}`}
                            placeholder={prop.description || name}
                            value={params[name] || ''}
                            onChange={(e) => handleParamChange(name, e.target.value)}
                          />
                        ) : (
                          <input
                            type="text"
                            className={styles.paramInput}
                            placeholder={prop.description || name}
                            value={params[name] || ''}
                            onChange={(e) => handleParamChange(name, e.target.value)}
                          />
                        )}
                      </div>
                    ))
                  )}

                  <button
                    className={styles.executeBtn}
                    onClick={handleExecute}
                    disabled={loading || status !== 'connected'}
                  >
                    {loading ? 'Executing...' : 'Execute'}
                  </button>
                </div>
              </div>

              {/* Response Panel */}
              <div className={styles.responsePanel}>
                <div className={styles.responseHeader}>
                  <span className={styles.responseTitle}>Response</span>
                  {response && (
                    <span className={`${styles.responseStatus} ${response.success ? styles.success : styles.error}`}>
                      <span className={styles.responseDot} />
                      {response.success ? 'Success' : 'Error'}
                    </span>
                  )}
                </div>
                <div className={styles.responseBody}>
                  {response ? (
                    renderMcpResponse(response.data)
                  ) : (
                    <div className={styles.responsePlaceholder}>
                      Execute a tool to see the response
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Logs Panel when no tool selected */
            <div className={styles.responsePanel}>
              <div className={styles.responseHeader}>
                <span className={styles.responseTitle}>Connection Log</span>
                <button
                  className={styles.clearLogsBtn}
                  onClick={() => setLogs([])}
                >
                  Clear
                </button>
              </div>
              <div className={styles.responseBody}>
                {logs.length === 0 ? (
                  <div className={styles.responsePlaceholder}>
                    Connect to the MCP server to see logs
                  </div>
                ) : (
                  <div className={styles.logsList}>
                    {logs.map((log, i) => (
                      <div key={i} className={`${styles.logEntry} ${styles[log.type]}`}>
                        <span className={styles.logTime}>{formatTime(log.time)}</span>
                        <span className={styles.logType}>{log.type.toUpperCase()}</span>
                        <pre className={styles.logMessage}>{log.message}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
