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
  
  // KDB+ type to byte size mapping
  const getKdbTypeSize = (type: string, columnIndex?: number): number => {
    const typeSizes: Record<string, number> = {
      // KDB+ primitive types
      'boolean': 1, 'byte': 1, 'short': 2, 'int': 4, 'long': 8,
      'real': 4, 'float': 8, 'char': 1, 'symbol': 8,
      // KDB+ temporal types
      'timestamp': 8, 'datetime': 8, 'timespan': 8,
      'date': 4, 'month': 4, 'minute': 4, 'second': 4, 'time': 4,
      // Inferred types from server
      'number': 8
    };
    
    // Handle variable-length string types
    if (type === 'string' && columnIndex !== undefined && data?.data) {
      // Calculate average string length for this column
      const sampleSize = Math.min(100, data.data.length); // Sample first 100 rows
      let totalLength = 0;
      let validStrings = 0;
      
      for (let i = 0; i < sampleSize; i++) {
        const value = data.data[i]?.[columnIndex];
        if (typeof value === 'string') {
          totalLength += value.length;
          validStrings++;
        }
      }
      
      return validStrings > 0 ? Math.max(1, Math.round(totalLength / validStrings)) : 8;
    }
    
    return typeSizes[type] || 8; // fallback to 8 bytes
  };

  // Calculate accurate data size using type information
  const calculateDataSize = (): number => {
    if (!data?.meta?.types || data.meta.types.length === 0) {
      // Fallback to generic calculation if no type info
      return rowCount * columnCount * 8;
    }

    // Use actual type information for accurate sizing
    return data.meta.types.reduce((totalSize, type, columnIndex) => {
      const bytesPerValue = getKdbTypeSize(type, columnIndex);
      return totalSize + (rowCount * bytesPerValue);
    }, 0);
  };

  const estimatedSize = calculateDataSize();
  const formattedSize = estimatedSize < 1024 
    ? `${estimatedSize} B`
    : estimatedSize < 1024 * 1024
    ? `${(estimatedSize / 1024).toFixed(1)} KB`
    : `${(estimatedSize / (1024 * 1024)).toFixed(1)} MB`;

  // Calculate browser memory usage
  const getMemoryUsage = (): string => {
    // Check if performance.memory API is available (Chrome/Edge only)
    if ('performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      
      if (usedMB < 1024) {
        return `${Math.round(usedMB)}MB`;
      } else {
        return `${(usedMB / 1024).toFixed(1)}GB`;
      }
    }
    
    // Fallback: estimate based on data size
    if (estimatedSize > 0) {
      const estimatedMemoryMB = estimatedSize / (1024 * 1024) * 2; // Rough 2x multiplier for overhead
      if (estimatedMemoryMB < 1) {
        return `~${Math.max(1, Math.round(estimatedMemoryMB * 1024))}KB`;
      } else if (estimatedMemoryMB < 1024) {
        return `~${Math.round(estimatedMemoryMB)}MB`;
      } else {
        return `~${(estimatedMemoryMB / 1024).toFixed(1)}GB`;
      }
    }
    
    return '--';
  };

  const formattedMemory = getMemoryUsage();

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
        
        {/* Memory Usage */}
        <div className="flex items-center space-x-1.5">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Memory:</span>
          <span className="font-medium">{formattedMemory}</span>
        </div>
      </div>
    </div>
  );
}