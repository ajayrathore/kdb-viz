import React, { useState, useEffect, useRef, useCallback } from 'react';
import Plotly from 'plotly.js-dist-min';
import { X, BarChart3, LineChart, TrendingUp, Settings, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KdbQueryResult, ChartConfig } from '@/types/kdb';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: KdbQueryResult;
}

type ChartType = 'line' | 'bar' | 'scatter' | 'histogram' | 'area';

export function ChartModal({ isOpen, onClose, data }: ChartModalProps) {
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'bar',
    xColumn: '',
    yColumn: '',
    title: 'Data Visualization'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [chartDimensions, setChartDimensions] = useState({ width: 1200, height: 700 });
  const [isResizing, setIsResizing] = useState(false);
  const [filteredTickValues, setFilteredTickValues] = useState<string[] | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const numericColumns = data.columns.filter((_, index) => {
    const sampleValues = data.data.slice(0, 10).map(row => row[index]);
    return sampleValues.some(val => typeof val === 'number' && !isNaN(val));
  });

  const categoricalColumns = data.columns.filter(column => !numericColumns.includes(column));

  // Set default columns when modal opens
  useEffect(() => {
    if (isOpen && numericColumns.length >= 2) {
      setChartConfig(prev => ({
        ...prev,
        xColumn: numericColumns[0],
        yColumn: numericColumns[1]
      }));
    } else if (isOpen && numericColumns.length === 1 && categoricalColumns.length >= 1) {
      setChartConfig(prev => ({
        ...prev,
        xColumn: categoricalColumns[0],
        yColumn: numericColumns[0]
      }));
    }
  }, [isOpen, data]);

  // Simple, reliable label density calculation
  useEffect(() => {
    if (!isOpen || !data || !data.data || data.data.length === 0) {
      setFilteredTickValues(null);
      return;
    }

    // Calculate target number of ticks based on chart width
    // For rotated labels, we need more space between them
    const labelSpaceNeeded = 100; // pixels per rotated label
    const targetTicks = Math.min(15, Math.max(5, Math.floor(chartDimensions.width / labelSpaceNeeded)));
    
    // Store the target tick count (we'll use this in Plotly config)
    setFilteredTickValues([targetTicks.toString()]);
  }, [isOpen, data, chartConfig.xColumn, chartConfig.yColumn, chartDimensions.width]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Generate Plotly.js chart
  useEffect(() => {
    if (!chartRef.current || !chartConfig.xColumn || !chartConfig.yColumn || !isOpen) return;

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

      // Helper function to detect if data is time-based
      const isTimeData = (value: any) => {
        if (typeof value === 'string') {
          return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) || 
                 /^\d{2}:\d{2}:\d{2}/.test(value);
        }
        return value instanceof Date;
      };

      const xIsTime = plotData.length > 0 && isTimeData(plotData[0].x);
      
      // Get target tick count from our calculation
      const targetTicks = filteredTickValues && filteredTickValues.length > 0 
        ? parseInt(filteredTickValues[0]) 
        : 8;

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
        width: chartDimensions.width,
        height: chartDimensions.height,
        xaxis: {
          title: chartConfig.xColumn,
          tickangle: -45,
          color: 'hsl(var(--foreground))',
          showgrid: false,
          nticks: targetTicks,  // THIS IS THE KEY - direct tick control!
          automargin: true
        },
        yaxis: {
          title: chartConfig.yColumn,
          color: 'hsl(var(--foreground))',
          showgrid: false,
          automargin: true
        }
      };

      // Time-specific axis configuration
      if (xIsTime) {
        layout.xaxis.type = 'date';
        layout.xaxis.tickformat = '%H:%M:%S';
      }

      // Plotly configuration
      const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: false
      };

      // Clear and create new plot
      Plotly.newPlot(chartRef.current, [trace], layout, config);

    } catch (error) {
      console.error('Error creating Plotly visualization:', error);
      if (chartRef.current) {
        chartRef.current.innerHTML = '<div class="p-4 text-center text-destructive">Error creating visualization</div>';
      }
    }
  }, [chartConfig, data, isOpen, chartDimensions]);

  // Regenerate chart when dimensions change
  useEffect(() => {
    if (isOpen && chartConfig.xColumn && chartConfig.yColumn) {
      // Small delay to allow DOM to update after resize
      const timer = setTimeout(() => {
        // Trigger chart regeneration by updating a dependency
        setChartConfig(prev => ({ ...prev }));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [chartDimensions, isOpen, chartConfig.xColumn, chartConfig.yColumn]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: chartDimensions.width,
      height: chartDimensions.height
    };
  }, [chartDimensions]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeStartRef.current) return;
    
    e.preventDefault();
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    
    const newWidth = Math.max(600, Math.min(1800, resizeStartRef.current.width + deltaX));
    const newHeight = Math.max(400, Math.min(1200, resizeStartRef.current.height + deltaY));
    
    setChartDimensions({ width: newWidth, height: newHeight });
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizeStartRef.current = null;
  }, []);

  // Handle mouse events for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'nw-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const chartTypes: { type: ChartType; label: string; icon: React.ReactNode }[] = [
    { type: 'bar', label: 'Bar Chart', icon: <BarChart3 className="h-4 w-4" /> },
    { type: 'line', label: 'Line Chart', icon: <LineChart className="h-4 w-4" /> },
    { type: 'scatter', label: 'Scatter Plot', icon: <BarChart3 className="h-4 w-4" /> },
    { type: 'histogram', label: 'Histogram', icon: <TrendingUp className="h-4 w-4" /> },
    { type: 'area', label: 'Area Chart', icon: <LineChart className="h-4 w-4" /> },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      {/* Modal Content */}
      <div className="bg-card rounded-lg shadow-2xl w-full h-full max-w-none max-h-none flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-foreground">Data Visualization</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {showSettings ? 'Hide' : 'Show'} Controls
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-10 w-10 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Chart Controls */}
        {showSettings && (
          <div className="p-6 border-b border-border bg-muted/20">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Chart Type */}
              <div>
                <label className="text-sm font-medium mb-3 block text-foreground">Chart Type</label>
                <div className="flex flex-wrap gap-2">
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

              {/* X-Axis */}
              <div>
                <label className="text-sm font-medium mb-3 block text-foreground">X-Axis</label>
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

              {/* Y-Axis */}
              <div>
                <label className="text-sm font-medium mb-3 block text-foreground">Y-Axis</label>
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

              {/* Chart Title */}
              <div>
                <label className="text-sm font-medium mb-3 block text-foreground">Chart Title</label>
                <input
                  type="text"
                  value={chartConfig.title || ''}
                  onChange={(e) => setChartConfig(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter chart title"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          {!chartConfig.xColumn || !chartConfig.yColumn ? (
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl mb-2">Select columns to create a visualization</p>
              <p className="text-sm">Choose X and Y axis columns from the controls above</p>
            </div>
          ) : (
            <div className="relative">
              <div 
                ref={chartRef} 
                className="flex justify-center items-center"
                style={{ 
                  width: chartDimensions.width, 
                  height: chartDimensions.height,
                  border: isResizing ? '2px dashed hsl(var(--primary))' : '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  position: 'relative'
                }}
              />
              {/* Resize Handle */}
              <div
                className="absolute bottom-0 right-0 w-6 h-6 bg-primary/20 hover:bg-primary/40 cursor-nw-resize rounded-tl-md border-l border-t border-primary/50 flex items-center justify-center"
                onMouseDown={handleResizeStart}
                title="Drag to resize chart"
              >
                <Maximize2 className="h-3 w-3 text-primary rotate-90" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}