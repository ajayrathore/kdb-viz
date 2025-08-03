export interface KdbConnection {
  host: string;
  port: number;
  connected: boolean;
  error?: string;
}

export interface KdbTable {
  name: string;
  columns: string[];
  rowCount: number;
}

export interface KdbTableMetadata {
  tableName: string;
  columns: KdbColumnMetadata[];
}

export interface KdbColumnMetadata {
  name: string;
  type: string;
  foreignKey: string;
  attributes: string;
}

export interface KdbQueryResult {
  columns: string[];
  data: any[][];
  meta?: {
    types: string[];
    count: number;
  };
}

export interface KdbFunction {
  name: string;
  parameters: KdbParameter[];
  description?: string;
}

export interface KdbParameter {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type ChartType = 
  | 'line' 
  | 'bar' 
  | 'scatter' 
  | 'histogram' 
  | 'area'
  | 'candlestick'
  | 'ohlc'
  | 'volume'
  | 'heatmap'
  | 'box'
  | 'waterfall'
  | 'band';

export interface ChartConfig {
  type: ChartType;
  xColumn: string;
  yColumn: string;  // Keep for backward compatibility
  yColumns: string[];  // New: support multiple Y columns
  colorColumn?: string;
  title?: string;
  // Area chart stacking option
  stackedArea?: boolean;
  // Additional fields for OHLC charts
  openColumn?: string;
  highColumn?: string;
  lowColumn?: string;
  closeColumn?: string;
  // Additional fields for band/range charts
  upperColumn?: string;
  lowerColumn?: string;
  // Heatmap configuration
  heatmapConfig?: HeatmapConfig;
}

export interface HeatmapConfig {
  // Type of heatmap visualization
  heatmapType?: 'auto' | 'density' | 'volume' | 'price_activity' | 'simple_values';
  // Time bucketing for time-series data
  timeBuckets?: number;
  // Value buckets for non-time data
  valueBuckets?: number;
  // Color scale preference
  colorScale?: 'Viridis' | 'Hot' | 'RdYlGn' | 'Blues' | 'Plasma' | 'Cividis';
  // Whether to enhance contrast for "hot vs cold" visualization
  enhanceContrast?: boolean;
  // Custom aggregation method
  aggregationMethod?: 'count' | 'sum' | 'mean' | 'max' | 'min';
}

export type HeatmapType = 'density' | 'volume' | 'price_activity' | 'simple_values' | 'multi_series';

export interface HeatmapDataResult {
  x: (string | number)[];
  y: (string | number)[];
  z: number[][];
  colorscale?: string;
  type: HeatmapType;
  title?: string;
  metadata?: {
    detectedDataType: 'single_column' | 'time_price' | 'time_volume' | 'ohlc' | 'unknown';
    timeBucketSize?: number;
    valueBucketSize?: number;
    totalDataPoints: number;
    maxIntensity: number;
  };
}