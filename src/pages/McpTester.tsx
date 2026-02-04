import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { JSONRPCClient } from 'json-rpc-2.0';
import { useAuth } from '../stores/auth';
import { API_BASE } from '../lib/api';
import styles from './McpTester.module.css';

// Derive MCP URL from API_BASE
const DEFAULT_MCP_URL = `${API_BASE}/mcp`;

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
    () => localStorage.getItem('mcp_url') || DEFAULT_MCP_URL
  );
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<{ success: boolean; data: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Array<{ type: 'send' | 'recv' | 'info' | 'error'; message: string; time: Date }>>([]);

  // Page tabs
  const [activeTab, setActiveTab] = useState<'setup' | 'tester'>('setup');

  // MCP Setup state
  const [selectedClient, setSelectedClient] = useState<string>('claude-code');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const clientRef = useRef<JSONRPCClient | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(id);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get the token to use in commands (from current session)
  const displayToken = token || 'YOUR_TOKEN_HERE';

  // MCP client configurations - uses DEFAULT_MCP_URL from env
  const mcpClients = useMemo(() => ({
    'claude-code': {
      name: 'Claude Code',
      command: `claude mcp add -t http -s user fold ${DEFAULT_MCP_URL}?token=${displayToken}`,
      instructions: [
        'Run the command above in your terminal (Windows, Mac, or Linux)',
        'For authentication via Authorization header instead, use: <code>--header "Authorization: Bearer ${displayToken}"</code>',
        'Restart Claude Code or run <code>claude mcp list</code> to verify',
        'The Fold MCP tools will be available in your Claude Code sessions',
      ],
    },
    'claude-desktop': {
      name: 'Claude Desktop',
      command: `${DEFAULT_MCP_URL}?token=${displayToken}

Alternative with Authorization header:
${DEFAULT_MCP_URL}
Header: Authorization: Bearer ${displayToken}`,
      instructions: [
        'Open Claude Desktop and go to <strong>Settings > Connectors</strong>',
        'Click <strong>"Add custom connector"</strong>',
        'Enter the MCP server URL above (with embedded token)',
        'Leave OAuth credentials blank unless your server requires them',
        'Click <strong>"Add"</strong> to complete setup',
        'Toggle the connector on in the conversation to use Fold tools',
      ],
    },
    'cursor': {
      name: 'Cursor',
      command: `{
  "mcpServers": {
    "fold": {
      "url": "${DEFAULT_MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${displayToken}"
      }
    }
  }
}`,
      instructions: [
        'Open Cursor Settings (Cmd/Ctrl + ,)',
        'Search for "MCP" or navigate to Features > MCP',
        'Add a new MCP server with the configuration above',
        'Restart Cursor to enable the Fold tools',
      ],
    },
    'windsurf': {
      name: 'Windsurf',
      command: `{
  "mcpServers": {
    "fold": {
      "url": "${DEFAULT_MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${displayToken}"
      }
    }
  }
}`,
      instructions: [
        'Open Windsurf Settings',
        'Navigate to the MCP configuration section',
        'Add the Fold server configuration',
        'Restart the editor to connect to Fold',
      ],
    },
    'generic': {
      name: 'Generic HTTP',
      command: `# MCP Server URL
${DEFAULT_MCP_URL}

# Authentication (choose one):
# 1. Authorization Header (Recommended)
Authorization: Bearer ${displayToken}

# 2. Query String (for clients with header limitations)
${DEFAULT_MCP_URL}?token=${displayToken}

# Example curl with header
curl -X POST ${DEFAULT_MCP_URL} \\
  -H "Authorization: Bearer ${displayToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'`,
      instructions: [
        'Use the URL above for any MCP-compatible client',
        'The server uses JSON-RPC 2.0 over HTTP',
        'Authenticate using either Authorization header <strong>(recommended)</strong> or query string token parameter',
        'For query string auth: append <code>?token=YOUR_TOKEN</code> to the URL',
        'See the MCP specification for available methods',
      ],
    },
    'custom-connector': {
      name: 'Claude Custom Connector',
      command: `{
  "apiUrl": "${DEFAULT_MCP_URL}?token=${displayToken}",
  "protocol": "json-rpc",
  "headers": {
    "Content-Type": "application/json"
  }
}`,
      instructions: [
        'Add a new Custom Connector in Claude settings',
        'Use the URL with embedded token (query string) above',
        'Alternatively, use Authorization header: <code>Authorization: Bearer ${displayToken}</code>',
        'The token in the URL allows Claude to authenticate without requiring custom headers',
        'This is useful when the connector client doesn\'t support custom headers',
      ],
    },
  }), [displayToken]);

  const currentClient = mcpClients[selectedClient as keyof typeof mcpClients];

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
    const regex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],:])/g;
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
        <h1 className={styles.pageTitle}>MCP Tools</h1>
        <p className={styles.pageSubtitle}>Configure MCP clients and test tools via JSON-RPC 2.0</p>
      </div>

      {/* Page Tabs */}
      <div className={styles.pageTabs}>
        <button
          className={`${styles.pageTab} ${activeTab === 'setup' ? styles.active : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Client Setup
        </button>
        <button
          className={`${styles.pageTab} ${activeTab === 'tester' ? styles.active : ''}`}
          onClick={() => setActiveTab('tester')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          Tester
        </button>
      </div>

      {/* Client Setup Tab */}
      {activeTab === 'setup' && (
        <div className={styles.setupTab}>
            {/* MCP Client Instructions */}
            <div className={styles.tokenSectionTitle}>Setup Instructions</div>

            <div className={styles.mcpClientTabs}>
              {Object.entries(mcpClients).map(([key, client]) => (
                <button
                  key={key}
                  className={`${styles.mcpClientTab} ${selectedClient === key ? styles.active : ''}`}
                  onClick={() => setSelectedClient(key)}
                >
                  {client.name}
                </button>
              ))}
            </div>

            <div className={styles.codeBlock}>
              <div className={styles.codeBlockHeader}>
                <span className={styles.codeBlockTitle}>
                  {selectedClient === 'claude-code' ? 'Terminal Command' : 'Configuration'}
                </span>
                <button
                  className={`${styles.codeBlockCopy} ${copiedCommand === 'command' ? styles.copied : ''}`}
                  onClick={() => copyToClipboard(currentClient.command, 'command')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {copiedCommand === 'command' ? (
                      <polyline points="20 6 9 17 4 12" />
                    ) : (
                      <>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </>
                    )}
                  </svg>
                  {copiedCommand === 'command' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className={styles.codeBlockContent}>
                <pre>{currentClient.command}</pre>
              </div>
            </div>

            <div className={styles.instructions}>
              <div className={styles.instructionsTitle}>How to set up {currentClient.name}</div>
              <ol className={styles.instructionsList}>
                {currentClient.instructions.map((instruction, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: instruction }} />
                ))}
              </ol>
            </div>
        </div>
      )}

      {/* Tester Tab */}
      {activeTab === 'tester' && (
        <>
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
          placeholder={`MCP endpoint URL (default: ${DEFAULT_MCP_URL})`}
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
        </>
      )}
    </motion.div>
  );
}
