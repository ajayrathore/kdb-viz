import { Database, Hash, Clock, Activity, Zap, TrendingUp } from 'lucide-react';
import { KdbQueryResult } from '@/types/kdb';

interface StatusBarProps {
  data: KdbQueryResult | null;
  isLoading: boolean;
  queryTime?: number;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export function StatusBar({ data, queryTime, connectionStatus }: StatusBarProps) {
  // Calculate stats
  const rowCount = data?.data?.length || 0;
  const columnCount = data?.columns?.length || 0;
  
  // Calculate numeric column stats
  const numericColumns = data?.columns?.filter((_, idx) => 
    data.data.some(row => typeof row[idx] === 'number')
  ).length || 0;
  
  // Format query time
  const formattedQueryTime = queryTime 
    ? queryTime < 1000 
      ? `${queryTime.toFixed(0)}ms` 
      : `${(queryTime / 1000).toFixed(2)}s`
    : '--';
  
  // Estimate data size (rough approximation)
  const estimatedSize = rowCount * columnCount * 8; // 8 bytes average per cell
  const formattedSize = estimatedSize < 1024 
    ? `${estimatedSize} B`
    : estimatedSize < 1024 * 1024
    ? `${(estimatedSize / 1024).toFixed(1)} KB`
    : `${(estimatedSize / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-background border-t border-border text-xs">
      <div className="flex items-center space-x-6">
        {/* Rows */}
        <div className="flex items-center space-x-1.5">
          <Database className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Rows:</span>
          <span className="font-medium">{rowCount.toLocaleString()}</span>
        </div>
        
        {/* Columns */}
        <div className="flex items-center space-x-1.5">
          <Hash className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Columns:</span>
          <span className="font-medium">{columnCount}</span>
          <span className="text-muted-foreground">({numericColumns} numeric)</span>
        </div>
        
        {/* Query Time */}
        <div className="flex items-center space-x-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Query Time:</span>
          <span className={`font-medium ${queryTime && queryTime > 5000 ? 'text-warning' : ''}`}>
            {formattedQueryTime}
          </span>
        </div>
        
        {/* Data Size */}
        <div className="flex items-center space-x-1.5">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Size:</span>
          <span className="font-medium">{formattedSize}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-6">
        {/* Connection Status */}
        <div className="flex items-center space-x-1.5">
          <Zap className={`h-3 w-3 ${
            connectionStatus === 'connected' ? 'text-success' : 'text-muted-foreground'
          }`} />
          <span className="text-muted-foreground">Connection:</span>
          <span className={`font-medium ${
            connectionStatus === 'connected' ? 'text-success' : ''
          }`}>
            {connectionStatus === 'connected' ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        {/* Memory (placeholder) */}
        <div className="flex items-center space-x-1.5">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Memory:</span>
          <span className="font-medium">--</span>
        </div>
      </div>
    </div>
  );
}