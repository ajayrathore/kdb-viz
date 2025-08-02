import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Clock, AlertCircle, Code } from 'lucide-react';
import { KdbQueryResult } from '@/types/kdb';

interface QueryExecutorProps {
  onExecuteQuery: (query: string) => Promise<KdbQueryResult>;
  isExecuting: boolean;
}

export function QueryExecutor({ onExecuteQuery, isExecuting }: QueryExecutorProps) {
  const [query, setQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleExecute = async () => {
    if (!query.trim() || isExecuting) return;

    try {
      setError(null);
      const result = await onExecuteQuery(query.trim());
      
      // Add to history if not already present
      if (!queryHistory.includes(query.trim())) {
        setQueryHistory(prev => [query.trim(), ...prev.slice(0, 9)]); // Keep last 10 queries
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
    }
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
  };

  const commonQueries = [
    'select from trades',
    'select count(*) from trades',
    'select sym, avg price by sym from trades',
    'select * from trades where sym=`AAPL',
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
              disabled={isExecuting}
            />
          </div>
          
          <Button
            onClick={handleExecute}
            disabled={!query.trim() || isExecuting}
            className="px-6"
          >
            {isExecuting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute
              </>
            )}
          </Button>
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

      </div>
    </div>
  );
}