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
}