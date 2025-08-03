import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function isValidHost(host: string): boolean {
  const hostRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return hostRegex.test(host) || host === 'localhost';
}

export function isValidPort(port: number): boolean {
  return port > 0 && port <= 65535;
}

// Financial data detection and heatmap utilities
export interface HeatmapData {
  x: (string | number)[];
  y: (string | number)[];
  z: number[][];
  colorscale?: string;
  type: 'density' | 'volume' | 'price_activity' | 'simple_values' | 'multi_series';
  title?: string;
}

export interface TimeSeriesDataPoint {
  time: any;
  value: number;
  volume?: number;
}

// Detect if data represents financial time series
export function detectFinancialDataType(columns: string[], data: any[][]): {
  type: 'single_column' | 'time_price' | 'time_volume' | 'ohlc' | 'unknown';
  timeColumn?: string;
  priceColumns?: string[];
  volumeColumn?: string;
} {
  if (columns.length === 1) {
    return { type: 'single_column' };
  }

  // Detect temporal columns
  const timeColumns = columns.filter((column, index) => {
    const lowerColumn = column.toLowerCase();
    const isTimeColumn = lowerColumn.includes('time') || 
                        lowerColumn.includes('date') || 
                        lowerColumn.includes('timestamp') ||
                        lowerColumn.includes('ts') ||
                        lowerColumn === 't';
    
    if (isTimeColumn && data.length > 0) {
      // Check if the data looks like time data
      const sample = data[0][index];
      return typeof sample === 'string' || sample instanceof Date;
    }
    return false;
  });

  // Detect numeric columns (potential price/volume)
  const numericColumns = columns.filter((_, index) => {
    const sampleValues = data.slice(0, 10).map(row => row[index]);
    return sampleValues.some(val => typeof val === 'number' && !isNaN(val));
  });

  // Detect volume columns
  const volumeColumns = columns.filter(column => {
    const lowerColumn = column.toLowerCase();
    return lowerColumn.includes('volume') || 
           lowerColumn.includes('vol') || 
           lowerColumn.includes('size') ||
           lowerColumn.includes('qty');
  });

  // Detect price columns
  const priceColumns = columns.filter(column => {
    const lowerColumn = column.toLowerCase();
    return lowerColumn.includes('price') || 
           lowerColumn.includes('close') || 
           lowerColumn.includes('open') ||
           lowerColumn.includes('high') ||
           lowerColumn.includes('low') ||
           lowerColumn.includes('px');
  });

  // Check for OHLC pattern
  const ohlcColumns = ['open', 'high', 'low', 'close'].filter(ohlcName => 
    columns.some(col => col.toLowerCase().includes(ohlcName))
  );

  if (ohlcColumns.length === 4) {
    return { 
      type: 'ohlc', 
      timeColumn: timeColumns[0],
      priceColumns: columns.filter(col => 
        ['open', 'high', 'low', 'close'].some(ohlc => col.toLowerCase().includes(ohlc))
      )
    };
  }

  if (timeColumns.length > 0 && volumeColumns.length > 0) {
    return { 
      type: 'time_volume', 
      timeColumn: timeColumns[0],
      volumeColumn: volumeColumns[0]
    };
  }

  if (timeColumns.length > 0 && (priceColumns.length > 0 || numericColumns.length > 0)) {
    return { 
      type: 'time_price', 
      timeColumn: timeColumns[0],
      priceColumns: priceColumns.length > 0 ? priceColumns : numericColumns.filter(col => !timeColumns.includes(col))
    };
  }

  return { type: 'unknown' };
}

// Universal KDB+ temporal data parser
export function parseKdbTemporal(value: any): { timestamp: number; type: 'time' | 'timestamp' | 'datetime' | 'date' | 'timespan' | 'unknown' } {
  if (value == null) return { timestamp: NaN, type: 'unknown' };

  // Handle string temporal formats
  if (typeof value === 'string') {
    // KDB time format: "09:30:00.123", "23:59:59", "00:00:00"
    const timeMatch = value.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{3}))?$/);
    if (timeMatch) {
      const [, hours, minutes, seconds, milliseconds = '0'] = timeMatch;
      const totalMs = (parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)) * 1000 + parseInt(milliseconds);
      return { timestamp: totalMs, type: 'time' };
    }

    // KDB date format: "2023.01.15" or "2023-01-15"
    const dateMatch = value.match(/^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})$/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return { timestamp: date.getTime(), type: 'date' };
    }

    // Standard datetime format: "2025-08-02 00:00:00.000"
    const standardDatetimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{3}))?$/);
    if (standardDatetimeMatch) {
      const [, year, month, day, hours, minutes, seconds, milliseconds = '0'] = standardDatetimeMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                           parseInt(hours), parseInt(minutes), parseInt(seconds), parseInt(milliseconds));
      return { timestamp: date.getTime(), type: 'datetime' };
    }

    // KDB datetime/timestamp: "2023.01.15D09:30:00.123" or ISO format
    const datetimeMatch = value.match(/^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})[DT](\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{3}))?/);
    if (datetimeMatch) {
      const [, year, month, day, hours, minutes, seconds, milliseconds = '0'] = datetimeMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                           parseInt(hours), parseInt(minutes), parseInt(seconds), parseInt(milliseconds));
      return { timestamp: date.getTime(), type: 'datetime' };
    }

    // Standard ISO format or other parseable formats
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) {
      return { timestamp: parsed, type: 'timestamp' };
    }
  }

  // Handle Date objects
  if (value instanceof Date) {
    return { timestamp: value.getTime(), type: 'datetime' };
  }

  // Handle numeric values
  const num = Number(value);
  if (!isNaN(num)) {
    // Determine the type based on magnitude
    if (num > 1000000000000) { // Large number, likely milliseconds since epoch
      return { timestamp: num, type: 'timestamp' };
    } else if (num > 1000000000) { // Medium number, likely seconds since epoch
      return { timestamp: num * 1000, type: 'timestamp' };
    } else if (num >= 0 && num < 86400000) { // Small number, likely milliseconds within a day
      return { timestamp: num, type: 'time' };
    } else if (num >= 0 && num < 86400) { // Very small number, likely seconds within a day
      return { timestamp: num * 1000, type: 'time' };
    } else {
      // Could be KDB date offset or other format
      return { timestamp: num, type: 'timespan' };
    }
  }

  return { timestamp: NaN, type: 'unknown' };
}

// Create time buckets for heatmap with universal KDB+ support
export function createTimeBuckets(timeData: any[], targetBuckets: number = 20): {
  buckets: string[];
  getBucketIndex: (time: any) => number;
} {
  const times = timeData.filter(t => t != null);
  console.log('🕒 Time bucket creation - input:', {
    timesLength: times.length,
    timeSamples: times.slice(0, 5),
    timeTypes: times.slice(0, 5).map(t => typeof t)
  });
  
  if (times.length === 0) {
    return { buckets: [], getBucketIndex: () => 0 };
  }

  // Parse all temporal values and analyze data characteristics
  const parsedTimes = times.map(parseKdbTemporal).filter(p => !isNaN(p.timestamp));
  
  if (parsedTimes.length === 0) {
    console.warn('🕒 No valid temporal data found');
    return { buckets: [], getBucketIndex: () => 0 };
  }

  // Determine the predominant temporal type
  const typeCount = parsedTimes.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const dominantType = Object.entries(typeCount).sort(([,a], [,b]) => b - a)[0][0];
  const timestamps = parsedTimes.map(p => p.timestamp);

  console.log('🕒 Temporal analysis:', {
    parsedLength: parsedTimes.length,
    dominantType,
    typeDistribution: typeCount,
    timestampRange: [Math.min(...timestamps), Math.max(...timestamps)],
    sampleTimestamps: timestamps.slice(0, 5)
  });

  if (timestamps.length === 0) {
    return { buckets: [], getBucketIndex: () => 0 };
  }

  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime;

  // Adaptive bucketing based on data characteristics
  let effectiveBuckets = targetBuckets;
  
  // For bucketed data (like 10-min intervals), detect and optimize
  if (dominantType === 'time' && timeRange < 86400000) { // Less than 24 hours
    // Check if data appears to be pre-bucketed
    const uniqueTimestamps = [...new Set(timestamps)].sort((a, b) => a - b);
    if (uniqueTimestamps.length <= 144) { // Likely pre-bucketed (e.g., 10-min buckets = 144 per day)
      effectiveBuckets = Math.min(uniqueTimestamps.length, targetBuckets);
      console.log('🪣 Detected pre-bucketed time data, using', effectiveBuckets, 'buckets');
    }
  }

  const bucketSize = timeRange > 0 ? timeRange / effectiveBuckets : 1;

  // Create bucket labels with smart formatting
  const buckets: string[] = [];
  for (let i = 0; i < effectiveBuckets; i++) {
    const bucketStart = minTime + (i * bucketSize);
    
    // Format based on dominant temporal type and time range
    if (dominantType === 'time') {
      // For time data, show as HH:MM or HH:MM:SS
      const hours = Math.floor(bucketStart / (1000 * 60 * 60)) % 24;
      const minutes = Math.floor((bucketStart % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((bucketStart % (1000 * 60)) / 1000);
      
      if (timeRange < 60 * 60 * 1000) { // Less than 1 hour, show seconds
        buckets.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        buckets.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      }
    } else {
      // For datetime/timestamp data, use date formatting
      const date = new Date(bucketStart);
      
      if (timeRange < 24 * 60 * 60 * 1000) { // Less than 1 day - show time
        buckets.push(date.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          second: timeRange < 60 * 60 * 1000 ? '2-digit' : undefined 
        }));
      } else if (timeRange < 7 * 24 * 60 * 60 * 1000) { // Less than 1 week - show date and time
        buckets.push(date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else { // More than 1 week - show date and time for better granularity
        buckets.push(date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }
  }

  const getBucketIndex = (time: any): number => {
    const parsed = parseKdbTemporal(time);
    if (isNaN(parsed.timestamp)) return 0;
    
    const bucketIndex = timeRange > 0 ? Math.floor((parsed.timestamp - minTime) / bucketSize) : 0;
    return Math.max(0, Math.min(bucketIndex, effectiveBuckets - 1));
  };

  return { buckets, getBucketIndex };
}

// Create value buckets for non-time data
export function createValueBuckets(values: number[], targetBuckets: number = 20): {
  buckets: string[];
  getBucketIndex: (value: number) => number;
} {
  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (validValues.length === 0) {
    return { buckets: [], getBucketIndex: () => 0 };
  }

  const minValue = Math.min(...validValues);
  const maxValue = Math.max(...validValues);
  const range = maxValue - minValue;
  const bucketSize = range / targetBuckets;

  const buckets: string[] = [];
  for (let i = 0; i < targetBuckets; i++) {
    const bucketStart = minValue + (i * bucketSize);
    const bucketEnd = bucketStart + bucketSize;
    buckets.push(`${bucketStart.toFixed(2)}-${bucketEnd.toFixed(2)}`);
  }

  const getBucketIndex = (value: number): number => {
    if (isNaN(value)) return 0;
    const bucketIndex = Math.floor((value - minValue) / bucketSize);
    return Math.max(0, Math.min(bucketIndex, targetBuckets - 1));
  };

  return { buckets, getBucketIndex };
}

// Generate heatmap for financial time series data (GitHub working version)
export function generateFinancialHeatmap(
  columns: string[],
  data: any[][],
  xColumn: string,
  yColumn: string | string[]
): HeatmapData {
  // Handle both single and multiple Y columns
  const yColumns = Array.isArray(yColumn) ? yColumn : [yColumn];
  const isMultiSeries = yColumns.length > 1;
  
  console.log('🔍 Heatmap Debug - Input:', {
    columns,
    dataLength: data.length,
    xColumn,
    yColumns,
    isMultiSeries,
    sampleData: data.slice(0, 3)
  });

  const dataType = detectFinancialDataType(columns, data);
  console.log('🔍 Detected data type:', dataType);
  
  const xColumnIndex = columns.indexOf(xColumn);
  if (xColumnIndex === -1) {
    throw new Error('Invalid X column selection');
  }

  // Get indices for all Y columns
  const yColumnIndices = yColumns.map(col => columns.indexOf(col));
  if (yColumnIndices.some(idx => idx === -1)) {
    throw new Error('Invalid Y column selection');
  }

  const xData = data.map(row => row[xColumnIndex]).filter(x => x != null);
  
  console.log('🔍 Raw data samples:', {
    xDataSample: xData.slice(0, 10),
    xDataTypes: xData.slice(0, 5).map(x => typeof x),
    yColumnsCount: yColumns.length
  });

  // Single column heatmap - show value distribution
  if (columns.length === 1 || (xColumn === yColumn)) {
    const values = data.map(row => row[0]).filter(v => typeof v === 'number' && !isNaN(v));
    const { buckets } = createValueBuckets(values, 15);
    
    // Create a simple distribution heatmap
    const z = [values.map(v => Math.abs(v - values.reduce((a, b) => a + b, 0) / values.length))];
    
    return {
      x: buckets,
      y: ['Distribution'],
      z: z,
      colorscale: 'Viridis',
      type: 'simple_values',
      title: 'Value Distribution Heatmap'
    };
  }

  // Time-based heatmaps (handles all KDB+ temporal types)
  if (dataType.type === 'time_price' || dataType.type === 'time_volume' || 
      (dataType.timeColumn && yColumns.some(col => 
        dataType.priceColumns?.includes(col) || 
        data.some(row => typeof row[columns.indexOf(col)] === 'number')
      ))) {
    
    const timeData = data.map(row => row[xColumnIndex]);
    
    console.log('📊 Multi-series heatmap processing:', {
      timeDataLength: timeData.length,
      yColumnsCount: yColumns.length,
      isMultiSeries,
      uniqueTimePoints: new Set(timeData).size
    });

    // Check if this is pre-aggregated data (one value per time point)
    const uniqueTimePoints = new Set(timeData.map(t => String(t))).size;
    const isPreAggregated = uniqueTimePoints === data.length || uniqueTimePoints / data.length > 0.9;
    
    console.log('📊 Data analysis:', {
      uniqueTimePoints,
      totalDataPoints: data.length,
      isPreAggregated,
      aggregationRatio: uniqueTimePoints / data.length
    });

    if (isPreAggregated) {
      console.log('🎯 Using pre-aggregated data strategy');
      
      if (isMultiSeries) {
        // Multi-series heatmap: each Y-column becomes a row
        console.log('🎯 Creating multi-series heatmap');
        
        // Create time-ordered data for all series
        const timeSeriesData = data.map(row => {
          const time = row[xColumnIndex];
          const values: { [key: string]: number } = {};
          yColumns.forEach((col, index) => {
            const value = row[yColumnIndices[index]];
            if (typeof value === 'number' && !isNaN(value)) {
              values[col] = value;
            }
          });
          return { time, values };
        }).filter(item => item.time != null && Object.keys(item.values).length > 0);

        if (timeSeriesData.length === 0) {
          throw new Error('No valid time-series data found');
        }

        // Sort by time
        timeSeriesData.sort((a, b) => {
          const parsedA = parseKdbTemporal(a.time);
          const parsedB = parseKdbTemporal(b.time);
          return parsedA.timestamp - parsedB.timestamp;
        });

        // Extract unique time points and ensure all series have values
        const sortedTimes = timeSeriesData.map(item => String(item.time));
        
        // Collect all values across all series for global normalization
        const allValues: number[] = [];
        timeSeriesData.forEach(item => {
          Object.values(item.values).forEach(value => {
            if (typeof value === 'number' && !isNaN(value)) {
              allValues.push(value);
            }
          });
        });

        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const valueRange = maxValue - minValue;

        console.log('📊 Multi-series normalization:', {
          minValue,
          maxValue,
          valueRange,
          seriesCount: yColumns.length,
          timePointsCount: sortedTimes.length
        });

        // Create matrix: rows = series, columns = time points
        const matrix: number[][] = yColumns.map(seriesName => {
          return timeSeriesData.map(item => {
            const value = item.values[seriesName];
            if (typeof value === 'number' && !isNaN(value)) {
              // Normalize value
              if (valueRange === 0) return 50; // All same value
              return ((value - minValue) / valueRange) * 100;
            }
            return 0; // Missing data
          });
        });

        return {
          x: sortedTimes,
          y: yColumns, // Series names as Y-axis
          z: matrix,
          colorscale: 'Plasma', // Purple (low) to Yellow (high)
          type: 'multi_series',
          title: `Multi-Series Values over Time`
        };
      } else {
        // Single series - original logic
        const timeValuePairs = data.map(row => ({
          time: row[xColumnIndex],
          value: row[yColumnIndices[0]]
        })).filter(pair => pair.time != null && typeof pair.value === 'number' && !isNaN(pair.value));

        if (timeValuePairs.length === 0) {
          throw new Error('No valid time-value pairs found');
        }

        // Sort by time for proper display
        timeValuePairs.sort((a, b) => {
          const parsedA = parseKdbTemporal(a.time);
          const parsedB = parseKdbTemporal(b.time);
          return parsedA.timestamp - parsedB.timestamp;
        });

        // Extract sorted arrays
        const sortedTimes = timeValuePairs.map(pair => String(pair.time));
        const sortedValues = timeValuePairs.map(pair => pair.value);

        // Normalize values for color mapping
        const minValue = Math.min(...sortedValues);
        const maxValue = Math.max(...sortedValues);
        const valueRange = maxValue - minValue;
        
        const normalizedValues = sortedValues.map(value => {
          if (valueRange === 0) return 50; // All same value
          return ((value - minValue) / valueRange) * 100;
        });

        console.log('📊 Single-series normalization:', {
          minValue,
          maxValue,
          valueRange,
          normalizedSample: normalizedValues.slice(0, 5)
        });

        // Create a simple 1-row heatmap showing values over time
        const matrix = [normalizedValues]; // Single row with normalized values
        
        return {
          x: sortedTimes,
          y: ['Values'],
          z: matrix,
          colorscale: 'Plasma', // Purple (low) to Yellow (high)
          type: 'simple_values',
          title: `${yColumns[0]} over Time`
        };
      }
    }

    // For non-aggregated data, use density approach (simplified)
    console.log('🎯 Using density-based strategy for non-aggregated data');
    
    // Get all numeric values for the first Y column for density calculation
    const firstYColumnIndex = yColumnIndices[0];
    const firstColumnValues = data.map(row => row[firstYColumnIndex]).filter(v => typeof v === 'number' && !isNaN(v));
    
    // Use reasonable bucket counts
    const timeBuckets = Math.min(20, Math.max(8, Math.floor(Math.sqrt(timeData.length / 5))));
    const valueBuckets = Math.min(12, Math.max(6, Math.floor(Math.sqrt(firstColumnValues.length / 5))));
    
    const { buckets: timeBucketLabels, getBucketIndex: getTimeBucketIndex } = createTimeBuckets(timeData, timeBuckets);
    const { buckets: valueBucketLabels, getBucketIndex: getValueBucketIndex } = createValueBuckets(firstColumnValues, valueBuckets);
    
    // Create density matrix
    const matrix: number[][] = Array(valueBucketLabels.length).fill(0).map(() => Array(timeBucketLabels.length).fill(0));
    
    data.forEach(row => {
      const timeValue = row[xColumnIndex];
      const dataValue = row[firstYColumnIndex];
      
      if (timeValue != null && typeof dataValue === 'number' && !isNaN(dataValue)) {
        const timeBucket = getTimeBucketIndex(timeValue);
        const valueBucket = getValueBucketIndex(dataValue);
        if (matrix[valueBucket] && matrix[valueBucket][timeBucket] !== undefined) {
          matrix[valueBucket][timeBucket] += 1;
        }
      }
    });

    // Normalize matrix
    const maxCount = Math.max(...matrix.flat());
    const normalizedMatrix = matrix.map(row => 
      row.map(cell => maxCount > 0 ? (cell / maxCount) * 100 : 0)
    );

    const firstColumnName = yColumns[0];
    return {
      x: timeBucketLabels,
      y: valueBucketLabels,
      z: normalizedMatrix,
      colorscale: firstColumnName.toLowerCase().includes('price') ? 'RdYlGn' : 
                 firstColumnName.toLowerCase().includes('vol') ? 'Hot' : 'Viridis',
      type: 'density',
      title: `${firstColumnName} Density over Time`
    };
  }

  // Default density heatmap for other cases
  console.log('📊 Default density heatmap fallback');
  
  const numericXData = xData.filter(v => typeof v === 'number');
  const firstYColumnData = data.map(row => row[yColumnIndices[0]]).filter(v => typeof v === 'number');
  
  console.log('🔢 Numeric data filtering:', {
    originalXLength: xData.length,
    numericXLength: numericXData.length,
    firstYColumnLength: firstYColumnData.length
  });
  
  // Use adaptive bucket sizes
  const adaptiveXBuckets = Math.max(8, Math.min(16, Math.floor(Math.sqrt(numericXData.length / 5))));
  const adaptiveYBuckets = Math.max(6, Math.min(12, Math.floor(Math.sqrt(firstYColumnData.length / 5))));
  
  const { buckets: xBuckets, getBucketIndex: getXBucketIndex } = createValueBuckets(numericXData, adaptiveXBuckets);
  const { buckets: yBuckets, getBucketIndex: getYBucketIndex } = createValueBuckets(firstYColumnData, adaptiveYBuckets);
  
  console.log('🪣 Default buckets created:', {
    xBucketsLength: xBuckets.length,
    yBucketsLength: yBuckets.length,
    xBucketSamples: xBuckets.slice(0, 3),
    yBucketSamples: yBuckets.slice(0, 3)
  });
  
  const matrix: number[][] = Array(yBuckets.length).fill(0).map(() => Array(xBuckets.length).fill(0));
  
  let validDataPoints = 0;
  data.forEach(row => {
    const xValue = row[xColumnIndex];
    const yValue = row[yColumnIndices[0]];
    
    if (typeof xValue === 'number' && typeof yValue === 'number' && !isNaN(xValue) && !isNaN(yValue)) {
      const xBucket = getXBucketIndex(xValue);
      const yBucket = getYBucketIndex(yValue);
      if (matrix[yBucket] && matrix[yBucket][xBucket] !== undefined) {
        matrix[yBucket][xBucket] += 1;
        validDataPoints++;
      }
    }
  });

  console.log('📈 Default matrix stats:', {
    validDataPoints,
    maxValue: Math.max(...matrix.flat()),
    populatedCells: matrix.flat().filter(cell => cell > 0).length,
    totalCells: matrix.length * (matrix[0]?.length || 0)
  });

  // Apply normalization for better color mapping
  const maxValue = Math.max(...matrix.flat());
  const normalizedMatrix = matrix.map(row => 
    row.map(cell => maxValue > 0 ? (cell / maxValue) * 100 : 0)
  );

  return {
    x: xBuckets,
    y: yBuckets,
    z: normalizedMatrix,
    colorscale: 'Viridis',
    type: 'density',
    title: 'Data Density Heatmap'
  };
}