import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Clock, AlertCircle, Code, AlertTriangle, Download } from 'lucide-react';

interface QueryExecutorEnhancedProps {
  onExecuteQuery: (query: string, options?: { offset?: number; limit?: number; countOnly?: boolean }) => Promise<any>;
  isExecuting: boolean;
}

export function QueryExecutorEnhanced({ onExecuteQuery, isExecuting }: QueryExecutorEnhancedProps) {
  const [query, setQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [resultInfo, setResultInfo] = useState<{ count: number; query: string } | null>(null);
  const [isCountChecking, setIsCountChecking] = useState(false);
  const [pageSize, setPageSize] = useState(1000);

  const checkResultSize = async () => {
    if (!query.trim() || isExecuting || isCountChecking) return;

    try {
      setError(null);
      setIsCountChecking(true);
      
      // First, get the count of results
      const count = await onExecuteQuery(query.trim(), { countOnly: true });
      
      setResultInfo({ count, query: query.trim() });
      
      // If result is small enough, execute directly
      if (count <= pageSize) {
        await executeQuery(0);  // No limit = no pagination
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check query size');
    } finally {
      setIsCountChecking(false);
    }
  };

  const executeQuery = async (offset: number = 0, limit?: number) => {
    try {
      setError(null);
      
      // Execute with pagination if limit is specified and greater than 0
      const result = await onExecuteQuery(
        resultInfo?.query || query.trim(), 
        limit !== undefined && limit > 0 ? { offset, limit } : undefined
      );
      
      // Add to history if not already present
      const queryToSave = resultInfo?.query || query.trim();
      if (!queryHistory.includes(queryToSave)) {
        setQueryHistory(prev => [queryToSave, ...prev.slice(0, 9)]); // Keep last 10 queries
      }
      
      // Clear result info after successful execution
      if (!limit || (result.pagination && !result.pagination.hasMore)) {
        setResultInfo(null);
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
    }
  };

  const handleExecute = async () => {
    await checkResultSize();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleExecute();
    }
  };

  const insertFromHistory = (historicalQuery: string) => {
    setQuery(historicalQuery);
    setShowHistory(false);
    setResultInfo(null);
  };

  const handleLoadAll = async () => {
    if (resultInfo) {
      await executeQuery(0); // Load all data
    }
  };

  const handleLoadPage = async () => {
    if (resultInfo) {
      await executeQuery(0, pageSize); // Load first page
    }
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    alert('Export functionality will be implemented in the next iteration');
  };

  const commonQueries = [
    'select from trades',
    'select count i from trades',
    'select sym, avg price by sym from trades',
    'select from trades where sym=`AAPL',
    'meta trades',
    'tables[]',
  ];

  return (
    <div className="bg-card border-b border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Code className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Query Executor</h3>
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
          
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-3 py-1 text-sm border border-border rounded-md bg-background text-foreground"
          >
            <option value={100}>100 rows</option>
            <option value={500}>500 rows</option>
            <option value={1000}>1,000 rows</option>
            <option value={5000}>5,000 rows</option>
            <option value={10000}>10,000 rows</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex space-x-2">
          <div className="flex-1">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your q query here... (Ctrl/Cmd + Enter to execute)"
              className="w-full h-20 px-3 py-2 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm bg-background text-foreground"
              disabled={isExecuting || isCountChecking}
            />
          </div>
          
          <Button
            onClick={handleExecute}
            disabled={!query.trim() || isExecuting || isCountChecking}
            className="px-6"
          >
            {isExecuting || isCountChecking ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isCountChecking ? 'Checking...' : 'Running...'}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute
              </>
            )}
          </Button>
        </div>

        {/* Large Result Warning */}
        {resultInfo && resultInfo.count > pageSize && (
          <div className="bg-warning/10 border border-warning/50 rounded-md p-4">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Large Result Set: {resultInfo.count.toLocaleString()} rows
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Loading all data may impact performance. Choose how to proceed:
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLoadPage}
                    disabled={isExecuting}
                  >
                    Load First {pageSize.toLocaleString()} Rows
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLoadAll}
                    disabled={isExecuting}
                  >
                    Load All Data
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExport}
                    disabled={isExecuting}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export to File
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setResultInfo(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

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

      </div>
    </div>
  );
}