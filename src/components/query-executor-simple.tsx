import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle, Code } from 'lucide-react';
import { KdbQueryResult } from '@/types/kdb';

interface QueryExecutorSimpleProps {
  onExecuteQuery: (query: string) => Promise<KdbQueryResult>;
  isExecuting: boolean;
}

// Query parsing types and interfaces
interface ParsedQuery {
  query: string;
  start: number;
  end: number;
  index: number;
}

// Core query parsing functions
const parseQueries = (text: string): ParsedQuery[] => {
  if (!text.trim()) return [];
  
  // Check if text contains semicolons
  if (!text.includes(';')) {
    // Single query mode - treat entire content as one query
    return [{
      query: text.trim(),
      start: 0,
      end: text.length,
      index: 0
    }];
  }
  
  // Multi-query mode - split by semicolons
  const parts = text.split(';');
  const queries: ParsedQuery[] = [];
  let currentPos = 0;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const queryText = part.trim();
    
    if (queryText) {
      // Find the actual start position of the trimmed query
      const untrimmedStart = currentPos;
      const trimmedStart = untrimmedStart + part.indexOf(part.trim());
      
      queries.push({
        query: queryText,
        start: trimmedStart,
        end: trimmedStart + queryText.length,
        index: i
      });
    }
    
    currentPos += part.length + 1; // +1 for semicolon
  }
  
  return queries;
};

const getCurrentQueryAtCursor = (text: string, cursorPos: number): string => {
  const queries = parseQueries(text);
  
  if (queries.length === 0) return '';
  if (queries.length === 1) return queries[0].query;
  
  // Find query containing cursor position
  for (const q of queries) {
    if (cursorPos >= q.start && cursorPos <= q.end) {
      return q.query;
    }
  }
  
  // If cursor is between queries, find the closest one
  let closestQuery = queries[0];
  let minDistance = Math.abs(cursorPos - queries[0].start);
  
  for (const q of queries) {
    const distanceToStart = Math.abs(cursorPos - q.start);
    const distanceToEnd = Math.abs(cursorPos - q.end);
    const distance = Math.min(distanceToStart, distanceToEnd);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestQuery = q;
    }
  }
  
  return closestQuery.query;
};

const getSelectedOrCurrentQuery = (
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  fullText: string
): string => {
  const textarea = textareaRef.current;
  if (!textarea) return fullText.trim();
  
  const { selectionStart, selectionEnd } = textarea;
  
  // If text is selected, execute selection
  if (selectionStart !== selectionEnd) {
    return fullText.substring(selectionStart, selectionEnd).trim();
  }
  
  // Otherwise, execute current query at cursor
  return getCurrentQueryAtCursor(fullText, selectionStart);
};

export function QueryExecutorSimple({ onExecuteQuery, isExecuting }: QueryExecutorSimpleProps) {
  const [query, setQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentQueryInfo, setCurrentQueryInfo] = useState<{index: number, total: number, selectedText?: string} | null>(null);
  
  // Textarea reference for selection handling
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Enhanced execution function for smart query selection
  const executeQuery = async (queryToExecute: string) => {
    if (!queryToExecute || isExecuting) return;

    try {
      setError(null);
      await onExecuteQuery(queryToExecute);
      
      // Add individual query to history if not already present
      if (!queryHistory.includes(queryToExecute)) {
        setQueryHistory(prev => [queryToExecute, ...prev.slice(0, 9)]); // Keep last 10 queries
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
    }
  };

  // Execute selected text or current query at cursor
  const handleExecuteSelected = async () => {
    if (!query.trim() || isExecuting) return;
    
    const queryToExecute = getSelectedOrCurrentQuery(textareaRef, query);
    
    // Enhanced error handling for edge cases
    if (!queryToExecute.trim()) {
      setError('No query to execute. Please ensure you have selected text or your cursor is within a query.');
      return;
    }
    
    // Check if the query is just whitespace or comments
    if (queryToExecute.trim().length === 0 || queryToExecute.trim().startsWith('//')) {
      setError('Selected text appears to be empty or a comment. Please select a valid query.');
      return;
    }
    
    await executeQuery(queryToExecute);
  };

  // Legacy function for backward compatibility (Ctrl+Enter)
  const handleExecute = async () => {
    await handleExecuteSelected();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isCtrlCmd = e.ctrlKey || e.metaKey;
    
    if (isCtrlCmd && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (isCtrlCmd && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      handleExecuteSelected();
    }
  };

  // Update current query info when cursor moves or text changes
  const updateCurrentQueryInfo = () => {
    if (!textareaRef.current || !query.trim()) {
      setCurrentQueryInfo(null);
      return;
    }

    const queries = parseQueries(query);
    if (queries.length <= 1) {
      setCurrentQueryInfo(null);
      return;
    }

    const { selectionStart, selectionEnd } = textareaRef.current;
    
    // If there's a selection, show that info instead
    if (selectionStart !== selectionEnd) {
      const selectedText = query.substring(selectionStart, selectionEnd).trim();
      if (selectedText) {
        setCurrentQueryInfo({
          index: 0, // Special case for selection
          total: queries.length,
          selectedText: selectedText.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText
        });
        return;
      }
    }

    // Otherwise show current query at cursor
    let currentIndex = 0;
    for (let i = 0; i < queries.length; i++) {
      if (selectionStart >= queries[i].start && selectionStart <= queries[i].end) {
        currentIndex = i;
        break;
      }
    }

    setCurrentQueryInfo({
      index: currentIndex + 1, // 1-based for display
      total: queries.length
    });
  };

  // Handle cursor movement and selection changes
  const handleCursorChange = () => {
    updateCurrentQueryInfo();
  };

  const insertFromHistory = (historicalQuery: string) => {
    setQuery(historicalQuery);
    setShowHistory(false);
  };

  const commonQueries = [
    'tables[]',
    'meta trades',
    'select from trades',
    'select count i from trades',
    'select sym, avg price by sym from trades',
    'select from trades where sym=`AAPL',
    // Multi-query examples
    'tables[]; meta trades; select count i from trades',
    'select from trades; select from quotes',
  ];

  return (
    <div className="bg-card border-b border-border p-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Code className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Query Executor</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="relative"
          >
            <Clock className="h-4 w-4 mr-2" />
            History
            {queryHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {queryHistory.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTimeout(updateCurrentQueryInfo, 0); // Update after state change
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={handleCursorChange}
            onClick={handleCursorChange}
            onSelect={handleCursorChange}
            placeholder="Enter your q query here... (Ctrl/Cmd + Enter or Ctrl/Cmd + E to execute)"
            className="w-full min-h-20 max-h-[80vh] px-3 py-2 border border-border rounded-md overflow-x-auto whitespace-pre focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm bg-background text-foreground"
            disabled={isExecuting}
            style={{ resize: 'both' }}
          />
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Query History Dropdown */}
        {showHistory && (
          <div className="bg-card border border-border rounded-md shadow-lg p-2 max-h-60 overflow-y-auto">
            <div className="text-sm font-medium text-foreground mb-2">Recent Queries</div>
            {queryHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No query history yet</div>
            ) : (
              <div className="space-y-1">
                {queryHistory.map((historicalQuery, index) => (
                  <button
                    key={index}
                    onClick={() => insertFromHistory(historicalQuery)}
                    className="w-full text-left px-2 py-1 text-sm hover:bg-accent rounded font-mono truncate"
                  >
                    {historicalQuery}
                  </button>
                ))}
              </div>
            )}
            
            <div className="border-t border-border mt-2 pt-2">
              <div className="text-sm font-medium text-foreground mb-2">Common Queries</div>
              <div className="space-y-1">
                {commonQueries.map((commonQuery, index) => (
                  <button
                    key={index}
                    onClick={() => insertFromHistory(commonQuery)}
                    className="w-full text-left px-2 py-1 text-sm hover:bg-accent rounded font-mono text-muted-foreground"
                  >
                    {commonQuery}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Tip: Use Ctrl/Cmd + Enter or Ctrl/Cmd + E to execute queries. Separate multiple queries with semicolons.
          </div>
          {currentQueryInfo && (
            <div className="flex items-center space-x-2">
              {currentQueryInfo.selectedText ? (
                <span className="text-primary font-medium">
                  Will execute: "{currentQueryInfo.selectedText}"
                </span>
              ) : (
                <span className="text-primary font-medium">
                  Query {currentQueryInfo.index} of {currentQueryInfo.total}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}