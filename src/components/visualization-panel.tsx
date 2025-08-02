import React, { useState, useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { 
  BarChart3, 
  LineChart, 
  TrendingUp, 
  Settings, 
  ChevronDown,
  CandlestickChart,
  BoxSelect,
  Activity,
  Grid3x3,
  Layers,
  BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KdbQueryResult, ChartConfig, ChartType } from '@/types/kdb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VisualizationPanelProps {
  data: KdbQueryResult;
  isExpanded?: boolean;
}

export function VisualizationPanel({ data, isExpanded = false }: VisualizationPanelProps) {
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'line',
    xColumn: '',
    yColumn: '',
    yColumns: [],
    title: 'Data Visualization'
  });
  const [showSettings, setShowSettings] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  const numericColumns = data.columns.filter((_, index) => {
    const sampleValues = data.data.slice(0, 10).map(row => row[index]);
    return sampleValues.some(val => typeof val === 'number' && !isNaN(val));
  });

  const categoricalColumns = data.columns.filter(column => !numericColumns.includes(column));

  // Detect temporal columns based on metadata or column names
  const temporalColumns = data.columns.filter((column, index) => {
    // Check metadata if available
    if (data.meta?.types && data.meta.types[index]) {
      const type = data.meta.types[index].toLowerCase();
      return type === 'timestamp' || type === 'date' || type === 'time' || type === 'datetime';
    }
    // Fallback to column name patterns
    const lowerColumn = column.toLowerCase();
    return lowerColumn.includes('time') || 
           lowerColumn.includes('date') || 
           lowerColumn.includes('timestamp') ||
           lowerColumn.includes('ts') ||
           lowerColumn === 't';
  });

  useEffect(() => {
    // Prefer temporal columns for x-axis
    if (temporalColumns.length > 0 && numericColumns.length > 0) {
      setChartConfig(prev => ({
        ...prev,
        xColumn: temporalColumns[0],
        yColumn: numericColumns.find(col => !temporalColumns.includes(col)) || numericColumns[0]
      }));
    } else if (numericColumns.length >= 2) {
      setChartConfig(prev => ({
        ...prev,
        xColumn: numericColumns[0],
        yColumn: numericColumns[1]
      }));
    } else if (numericColumns.length === 1 && categoricalColumns.length >= 1) {
      setChartConfig(prev => ({
        ...prev,
        xColumn: categoricalColumns[0],
        yColumn: numericColumns[0]
      }));
    }
  }, [data]);

  useEffect(() => {
    if (!chartRef.current || !chartConfig.xColumn || !chartConfig.yColumn) return;

    try {
      // Prepare data for plotting
      const xColumnIndex = data.columns.indexOf(chartConfig.xColumn);
      const yColumnIndex = data.columns.indexOf(chartConfig.yColumn);
      
      if (xColumnIndex === -1 || yColumnIndex === -1) return;

      const plotData = data.data.map(row => ({
        x: row[xColumnIndex],
        y: row[yColumnIndex]
      })).filter(d => d.x != null && d.y != null);

      if (plotData.length === 0) return;

      // Chart dimensions
      const chartWidth = isExpanded ? 1100 : 420;
      const chartHeight = isExpanded ? 500 : 320;
      
      // Calculate target number of ticks based on chart width
      const labelSpaceNeeded = 100;
      const targetTicks = Math.min(10, Math.max(5, Math.floor(chartWidth / labelSpaceNeeded)));

      // Prepare data arrays for Plotly
      const xData = plotData.map(d => d.x);
      const yData = plotData.map(d => d.y);

      // Define chart trace based on type
      let trace: any = {
        x: xData,
        y: yData,
        name: `${chartConfig.yColumn} vs ${chartConfig.xColumn}`,
        line: { color: '#3b82f6', width: 2 },
        marker: { color: '#3b82f6', size: 6 }
      };

      // Chart type-specific configuration
      let traces: any[] = [trace];
      
      switch (chartConfig.type) {
        case 'line':
          trace.type = 'scatter';
          trace.mode = 'lines+markers';
          break;
          
        case 'bar':
          trace.type = 'bar';
          delete trace.line;
          break;
          
        case 'scatter':
          trace.type = 'scatter';
          trace.mode = 'markers';
          delete trace.line;
          break;
          
        case 'histogram':
          trace = {
            x: xData,
            type: 'histogram',
            marker: { color: '#3b82f6' },
            name: chartConfig.xColumn
          };
          traces = [trace];
          break;
          
        case 'area':
          trace.type = 'scatter';
          trace.mode = 'lines';
          trace.fill = 'tonexty';
          trace.fillcolor = 'rgba(59, 130, 246, 0.3)';
          break;
          
        case 'candlestick':
          // For candlestick, we need OHLC columns
          // This is a placeholder - in real usage, user would select OHLC columns
          trace = {
            x: xData,
            close: yData,
            high: yData.map(v => v * 1.05),
            low: yData.map(v => v * 0.95),
            open: yData.map(v => v * (0.98 + Math.random() * 0.04)),
            type: 'candlestick',
            increasing: { line: { color: 'green' } },
            decreasing: { line: { color: 'red' } },
            name: 'OHLC'
          };
          traces = [trace];
          break;
          
        case 'ohlc':
          trace = {
            x: xData,
            close: yData,
            high: yData.map(v => v * 1.05),
            low: yData.map(v => v * 0.95),
            open: yData.map(v => v * (0.98 + Math.random() * 0.04)),
            type: 'ohlc',
            increasing: { line: { color: 'green' } },
            decreasing: { line: { color: 'red' } },
            name: 'OHLC'
          };
          traces = [trace];
          break;
          
        case 'volume':
          trace.type = 'bar';
          trace.marker = { color: '#22c55e' };
          delete trace.line;
          break;
          
        case 'heatmap':
          // Create a simple heatmap with the available data
          const uniqueX = [...new Set(xData)].slice(0, 10);
          const uniqueY = [...new Set(yData)].slice(0, 10);
          const z = uniqueX.map(() => uniqueY.map(() => Math.random()));
          
          trace = {
            x: uniqueX,
            y: uniqueY,
            z: z,
            type: 'heatmap',
            colorscale: 'Viridis'
          };
          traces = [trace];
          break;
          
        case 'box':
          trace = {
            y: yData,
            type: 'box',
            name: chartConfig.yColumn,
            marker: { color: '#3b82f6' }
          };
          traces = [trace];
          break;
          
        case 'waterfall':
          trace = {
            x: xData,
            y: yData,
            type: 'waterfall',
            increasing: { marker: { color: 'green' } },
            decreasing: { marker: { color: 'red' } },
            totals: { marker: { color: 'blue' } },
            connector: { line: { color: 'grey' } },
            name: 'Waterfall'
          };
          traces = [trace];
          break;
          
        case 'band':
          // Band chart showing upper and lower bounds
          const bandTrace = {
            x: xData,
            y: yData,
            type: 'scatter',
            mode: 'lines',
            name: 'Middle',
            line: { color: '#3b82f6' }
          };
          
          const upperTrace = {
            x: xData,
            y: yData.map(v => v * 1.1),
            type: 'scatter',
            mode: 'lines',
            name: 'Upper',
            line: { width: 0 },
            showlegend: false
          };
          
          const lowerTrace = {
            x: xData,
            y: yData.map(v => v * 0.9),
            type: 'scatter',
            mode: 'lines',
            name: 'Lower',
            fill: 'tonexty',
            fillcolor: 'rgba(59, 130, 246, 0.2)',
            line: { width: 0 },
            showlegend: false
          };
          
          traces = [lowerTrace, upperTrace, bandTrace];
          break;
      }

      // Layout configuration with proper axis control
      const layout: any = {
        title: {
          text: chartConfig.title,
          font: { size: 16, color: 'hsl(var(--foreground))' }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: 'hsl(var(--foreground))' },
        margin: { l: 80, r: 50, t: 80, b: 120 },
        width: chartWidth,
        height: chartHeight,
        xaxis: {
          title: chartConfig.xColumn,
          tickangle: -45,
          color: 'hsl(var(--foreground))',
          showgrid: false,
          nticks: targetTicks,
          automargin: true
        },
        yaxis: {
          title: chartConfig.yColumn,
          color: 'hsl(var(--foreground))',
          showgrid: false,
          automargin: true
        }
      };

      // Plotly configuration
      const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: false
      };

      // Create new plot
      Plotly.newPlot(chartRef.current, traces, layout, config);

    } catch (error) {
      console.error('Error creating Plotly visualization:', error);
      if (chartRef.current) {
        chartRef.current.innerHTML = '<div class="p-4 text-center text-destructive">Error creating visualization</div>';
      }
    }
  }, [chartConfig, data, isExpanded]);

  const chartTypes: { type: ChartType; label: string; icon: React.ReactNode; description?: string }[] = [
    { type: 'line', label: 'Line Chart', icon: <LineChart className="h-4 w-4" />, description: 'Best for time series' },
    { type: 'bar', label: 'Bar Chart', icon: <BarChart3 className="h-4 w-4" /> },
    { type: 'scatter', label: 'Scatter Plot', icon: <BoxSelect className="h-4 w-4" /> },
    { type: 'area', label: 'Area Chart', icon: <Layers className="h-4 w-4" /> },
    { type: 'candlestick', label: 'Candlestick', icon: <CandlestickChart className="h-4 w-4" />, description: 'OHLC data' },
    { type: 'ohlc', label: 'OHLC Bar', icon: <BarChart2 className="h-4 w-4" />, description: 'Open-High-Low-Close' },
    { type: 'volume', label: 'Volume', icon: <Activity className="h-4 w-4" />, description: 'Volume bars' },
    { type: 'heatmap', label: 'Heatmap', icon: <Grid3x3 className="h-4 w-4" /> },
    { type: 'box', label: 'Box Plot', icon: <BoxSelect className="h-4 w-4" />, description: 'Statistical distribution' },
    { type: 'waterfall', label: 'Waterfall', icon: <BarChart3 className="h-4 w-4" />, description: 'Cumulative changes' },
    { type: 'band', label: 'Band Chart', icon: <Layers className="h-4 w-4" />, description: 'Range visualization' },
    { type: 'histogram', label: 'Histogram', icon: <TrendingUp className="h-4 w-4" /> },
  ];
  
  const currentChartType = chartTypes.find(ct => ct.type === chartConfig.type) || chartTypes[0];

  return (
    <div className="h-full flex flex-col">
      {/* Settings Panel */}
      <div className={`p-4 border-b border-border bg-card ${isExpanded ? 'px-6 py-6' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`${isExpanded ? 'text-xl' : 'text-lg'} font-semibold text-foreground`}>
            {isExpanded ? 'Data Visualization' : 'Visualization'}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {showSettings && (
          <div className="space-y-4">
            {/* Chart Type Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block text-foreground">Chart Type</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between"
                  >
                    <span className="flex items-center space-x-2">
                      {currentChartType.icon}
                      <span>{currentChartType.label}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start">
                  {chartTypes.map(({ type, label, icon, description }) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => setChartConfig(prev => ({ ...prev, type }))}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center space-x-2">
                        {icon}
                        <span>{label}</span>
                      </span>
                      {description && (
                        <span className="text-xs text-muted-foreground ml-2">{description}</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Column Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-foreground">X-Axis</label>
                <select
                  value={chartConfig.xColumn}
                  onChange={(e) => setChartConfig(prev => ({ ...prev, xColumn: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select column</option>
                  {data.columns.map(column => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block text-foreground">Y-Axis</label>
                <select
                  value={chartConfig.yColumn}
                  onChange={(e) => setChartConfig(prev => ({ ...prev, yColumn: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select column</option>
                  {data.columns.map(column => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Chart Container */}
      <div className={`flex-1 overflow-auto bg-background ${isExpanded ? 'p-6' : 'p-6'}`}>
        {!chartConfig.xColumn || !chartConfig.yColumn ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select columns to create a visualization</p>
              <p className="text-sm mt-2">Choose X and Y axis columns from the controls above</p>
            </div>
          </div>
        ) : (
          <div 
            ref={chartRef} 
            className="flex justify-center w-full" 
            style={{ 
              minHeight: isExpanded ? '650px' : '400px',
              paddingBottom: '20px'
            }} 
          />
        )}
      </div>
    </div>
  );
}