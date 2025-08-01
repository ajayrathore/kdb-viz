import React, { useState, useEffect, useRef, useCallback } from 'react';
import Plotly from 'plotly.js-dist-min';
import { X, BarChart3, LineChart, TrendingUp, Settings, Maximize2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KdbQueryResult, ChartConfig } from '@/types/kdb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    yColumns: [],
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
        yColumn: numericColumns[1],
        yColumns: [numericColumns[1]]
      }));
    } else if (isOpen && numericColumns.length === 1 && categoricalColumns.length >= 1) {
      setChartConfig(prev => ({
        ...prev,
        xColumn: categoricalColumns[0],
        yColumn: numericColumns[0],
        yColumns: [numericColumns[0]]
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
    if (!chartRef.current || !chartConfig.xColumn || chartConfig.yColumns.length === 0 || !isOpen) return;

    try {
      // Color palette for multiple series
      const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
        '#06b6d4', '#a855f7', '#facc15', '#22c55e', '#f43f5e'
      ];

      // Prepare data for plotting
      const xColumnIndex = data.columns.indexOf(chartConfig.xColumn);
      if (xColumnIndex === -1) return;

      // Check if any data exists
      const hasData = chartConfig.yColumns.some(yCol => {
        const yIdx = data.columns.indexOf(yCol);
        return yIdx !== -1 && data.data.some(row => row[xColumnIndex] != null && row[yIdx] != null);
      });
      if (!hasData) return;

      // Helper function to detect if data is time-based
      const isTimeData = (value: any) => {
        if (typeof value === 'string') {
          return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) || 
                 /^\d{2}:\d{2}:\d{2}/.test(value);
        }
        return value instanceof Date;
      };

      const xIsTime = data.data.length > 0 && isTimeData(data.data[0][xColumnIndex]);
      
      // Get target tick count from our calculation
      const targetTicks = filteredTickValues && filteredTickValues.length > 0 
        ? parseInt(filteredTickValues[0]) 
        : 8;

      // Prepare traces for each Y column
      const traces: any[] = [];
      
      chartConfig.yColumns.forEach((yColumn, index) => {
        const yColumnIndex = data.columns.indexOf(yColumn);
        if (yColumnIndex === -1) return;
        
        const seriesData = data.data
          .map(row => ({ x: row[xColumnIndex], y: row[yColumnIndex] }))
          .filter(d => d.x != null && d.y != null);
        
        if (seriesData.length === 0) return;
        
        const xData = seriesData.map(d => d.x);
        const yData = seriesData.map(d => d.y);
        const color = colors[index % colors.length];
        
        traces.push({
          x: xData,
          y: yData,
          name: yColumn,
          line: { color: color, width: 2 },
          marker: { color: color, size: 6 }
        });
      });
      
      if (traces.length === 0) return;

      // Chart type-specific configuration for all traces
      traces.forEach((trace, index) => {
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
            // For histogram, we need to handle differently
            trace.type = 'histogram';
            trace.histnorm = '';
            trace.opacity = 0.7;
            delete trace.y;
            delete trace.line;
            break;
          case 'area':
            trace.type = 'scatter';
            trace.mode = 'lines';
            trace.fill = index === 0 ? 'tozeroy' : 'tonexty';
            trace.fillcolor = trace.line.color.replace(')', ', 0.3)').replace('rgb', 'rgba');
            break;
        }
      });

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
          title: chartConfig.yColumns.length > 1 ? 'Values' : chartConfig.yColumns[0] || '',
          color: 'hsl(var(--foreground))',
          showgrid: false,
          automargin: true
        },
        showlegend: chartConfig.yColumns.length > 1,
        legend: {
          orientation: 'v',
          x: 1.02,
          y: 1,
          xanchor: 'left',
          yanchor: 'top',
          bgcolor: 'rgba(0,0,0,0)',
          bordercolor: 'hsl(var(--border))',
          borderwidth: 1
        },
        barmode: chartConfig.type === 'bar' ? 'group' : undefined
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

      // Clear and create new plot with all traces
      Plotly.newPlot(chartRef.current, traces, layout, config);

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

              {/* Y-Axis Multi-Select */}
              <div>
                <label className="text-sm font-medium mb-3 block text-foreground">Y-Axis</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground text-left hover:bg-accent hover:border-accent-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent flex items-center justify-between">
                      <span className="truncate">
                        {chartConfig.yColumns.length === 0 
                          ? "Select columns" 
                          : chartConfig.yColumns.length === 1 
                          ? chartConfig.yColumns[0] 
                          : `${chartConfig.yColumns.length} columns selected`}
                      </span>
                      <Check className="h-4 w-4 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto">
                    <DropdownMenuLabel>Select Y-Axis Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={chartConfig.yColumns.length === numericColumns.length && numericColumns.length > 0}
                      onCheckedChange={(checked) => {
                        setChartConfig(prev => ({
                          ...prev,
                          yColumns: checked ? [...numericColumns] : [],
                          yColumn: checked && numericColumns.length > 0 ? numericColumns[0] : ''
                        }));
                      }}
                    >
                      Select All
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {numericColumns.map(column => (
                      <DropdownMenuCheckboxItem
                        key={column}
                        checked={chartConfig.yColumns.includes(column)}
                        onCheckedChange={(checked) => {
                          setChartConfig(prev => {
                            const newColumns = checked 
                              ? [...prev.yColumns, column]
                              : prev.yColumns.filter(c => c !== column);
                            return {
                              ...prev,
                              yColumns: newColumns,
                              yColumn: newColumns.length > 0 ? newColumns[0] : ''
                            };
                          });
                        }}
                      >
                        {column}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
          {!chartConfig.xColumn || chartConfig.yColumns.length === 0 ? (
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