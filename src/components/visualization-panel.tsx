import React, { useState, useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { BarChart3, LineChart, TrendingUp, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KdbQueryResult, ChartConfig } from '@/types/kdb';

interface VisualizationPanelProps {
  data: KdbQueryResult;
  isExpanded?: boolean;
}

type ChartType = 'line' | 'bar' | 'scatter' | 'histogram' | 'area';

export function VisualizationPanel({ data, isExpanded = false }: VisualizationPanelProps) {
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'bar',
    xColumn: '',
    yColumn: '',
    title: 'Data Visualization'
  });
  const [showSettings, setShowSettings] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  const numericColumns = data.columns.filter((_, index) => {
    const sampleValues = data.data.slice(0, 10).map(row => row[index]);
    return sampleValues.some(val => typeof val === 'number' && !isNaN(val));
  });

  const categoricalColumns = data.columns.filter(column => !numericColumns.includes(column));

  useEffect(() => {
    if (numericColumns.length >= 2) {
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
          break;
        case 'area':
          trace.type = 'scatter';
          trace.mode = 'lines';
          trace.fill = 'tonexty';
          trace.fillcolor = 'rgba(59, 130, 246, 0.3)';
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
      Plotly.newPlot(chartRef.current, [trace], layout, config);

    } catch (error) {
      console.error('Error creating Plotly visualization:', error);
      if (chartRef.current) {
        chartRef.current.innerHTML = '<div class="p-4 text-center text-destructive">Error creating visualization</div>';
      }
    }
  }, [chartConfig, data, isExpanded]);

  const chartTypes: { type: ChartType; label: string; icon: React.ReactNode }[] = [
    { type: 'bar', label: 'Bar Chart', icon: <BarChart3 className="h-4 w-4" /> },
    { type: 'line', label: 'Line Chart', icon: <LineChart className="h-4 w-4" /> },
    { type: 'scatter', label: 'Scatter Plot', icon: <BarChart3 className="h-4 w-4" /> },
    { type: 'histogram', label: 'Histogram', icon: <TrendingUp className="h-4 w-4" /> },
    { type: 'area', label: 'Area Chart', icon: <LineChart className="h-4 w-4" /> },
  ];

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
              <div className="flex flex-wrap gap-1">
                {chartTypes.map(({ type, label, icon }) => (
                  <Button
                    key={type}
                    variant={chartConfig.type === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartConfig(prev => ({ ...prev, type }))}
                    className="flex items-center space-x-1"
                  >
                    {icon}
                    <span className="hidden sm:inline">{label}</span>
                  </Button>
                ))}
              </div>
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

            {/* Title Input */}
            <div>
              <label className="text-sm font-medium mb-2 block text-foreground">Chart Title</label>
              <input
                type="text"
                value={chartConfig.title || ''}
                onChange={(e) => setChartConfig(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter chart title"
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
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