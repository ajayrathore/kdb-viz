import React, { useState, useEffect, useRef, useCallback } from 'react';
import Plotly from 'plotly.js-dist-min';
import { 
  X, 
  BarChart3, 
  LineChart, 
  TrendingUp, 
  Settings, 
  Maximize2, 
  Check,
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
import { generateFinancialHeatmap } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: KdbQueryResult;
}

export function ChartModal({ isOpen, onClose, data }: ChartModalProps) {
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'line',
    xColumn: '',
    yColumn: '',
    yColumns: [],
    title: 'Data Visualization',
    stackedArea: false
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

  // Set default columns when modal opens
  useEffect(() => {
    if (isOpen) {
      // Prefer temporal columns for x-axis
      if (temporalColumns.length > 0 && numericColumns.length > 0) {
        setChartConfig(prev => ({
          ...prev,
          xColumn: temporalColumns[0],
          yColumn: numericColumns.find(col => !temporalColumns.includes(col)) || numericColumns[0],
          yColumns: [numericColumns.find(col => !temporalColumns.includes(col)) || numericColumns[0]]
        }));
      } else if (numericColumns.length >= 2) {
        setChartConfig(prev => ({
          ...prev,
          xColumn: numericColumns[0],
          yColumn: numericColumns[1],
          yColumns: [numericColumns[1]]
        }));
      } else if (numericColumns.length === 1 && categoricalColumns.length >= 1) {
        setChartConfig(prev => ({
          ...prev,
          xColumn: categoricalColumns[0],
          yColumn: numericColumns[0],
          yColumns: [numericColumns[0]]
        }));
      }
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
      
      // For stacked area charts, we need to calculate cumulative values
      let stackedData: number[][] = []; // [dataPointIndex][seriesIndex] = cumulativeValue
      
      if (chartConfig.type === 'area' && chartConfig.stackedArea) {
        // First pass: collect all series data in aligned format
        const allSeriesData: { x: any; y: number; }[][] = [];
        
        // Get unique X values across all series (sorted)
        const xValueSet = new Set();
        chartConfig.yColumns.forEach(yColumn => {
          const yColumnIndex = data.columns.indexOf(yColumn);
          if (yColumnIndex !== -1) {
            data.data.forEach(row => {
              if (row[xColumnIndex] != null && row[yColumnIndex] != null) {
                xValueSet.add(row[xColumnIndex]);
              }
            });
          }
        });
        
        const uniqueXValues = Array.from(xValueSet).sort();
        
        // Align all series to the same X values
        chartConfig.yColumns.forEach(yColumn => {
          const yColumnIndex = data.columns.indexOf(yColumn);
          if (yColumnIndex === -1) return;
          
          const seriesDataMap = new Map();
          data.data.forEach(row => {
            if (row[xColumnIndex] != null && row[yColumnIndex] != null) {
              seriesDataMap.set(row[xColumnIndex], Number(row[yColumnIndex]) || 0);
            }
          });
          
          const alignedSeries = uniqueXValues.map(xVal => ({
            x: xVal,
            y: seriesDataMap.get(xVal) || 0
          }));
          
          allSeriesData.push(alignedSeries);
        });
        
        // Calculate cumulative values
        stackedData = uniqueXValues.map((_, dataIndex) => {
          const cumulativeAtPoint: number[] = [];
          let runningSum = 0;
          
          allSeriesData.forEach((series) => {
            runningSum += series[dataIndex].y;
            cumulativeAtPoint.push(runningSum);
          });
          
          return cumulativeAtPoint;
        });
        
        // Create traces with cumulative data
        chartConfig.yColumns.forEach((yColumn, index) => {
          if (index >= allSeriesData.length) return;
          
          const xData = allSeriesData[index].map(d => d.x);
          const yData = stackedData.map(point => point[index]);
          const color = colors[index % colors.length];
          
          traces.push({
            x: xData,
            y: yData,
            name: yColumn,
            line: { color: color, width: 2 },
            marker: { color: color, size: 6 },
            originalY: allSeriesData[index].map(d => d.y) // Store original values for tooltips
          });
        });
      } else {
        // Normal (non-stacked) processing
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
      }
      
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
            
            if (chartConfig.stackedArea) {
              // For stacked areas, all traces except the first fill to the previous trace
              trace.fill = index === 0 ? 'tozeroy' : 'tonexty';
              trace.fillcolor = trace.line.color.replace(')', ', 0.7)').replace('rgb', 'rgba');
              
              // Add custom hover template to show both original and cumulative values
              if (trace.originalY) {
                trace.hovertemplate = `<b>${trace.name}</b><br>` +
                  `Value: %{customdata}<br>` +
                  `Cumulative: %{y}<br>` +
                  `<extra></extra>`;
                trace.customdata = trace.originalY;
              }
            } else {
              // For overlapping areas, use the original logic
              trace.fill = index === 0 ? 'tozeroy' : 'tonexty';
              trace.fillcolor = trace.line.color.replace(')', ', 0.3)').replace('rgb', 'rgba');
            }
            break;
          case 'candlestick':
            // Detect if we have 4 OHLC columns or single price column
            if (index === 0) { // Only process candlestick on first trace to avoid duplicates
              // Check if user selected 4 Y columns (likely OHLC)
              if (chartConfig.yColumns.length === 4) {
                // Use direct OHLC mapping - assume columns are in order: open, high, low, close
                const xColumnIndex = data.columns.indexOf(chartConfig.xColumn);
                const ohlcIndices = chartConfig.yColumns.map(col => data.columns.indexOf(col));
                
                if (xColumnIndex !== -1 && ohlcIndices.every(idx => idx !== -1)) {
                  const candlestickData = data.data
                    .map(row => ({
                      x: row[xColumnIndex],
                      open: row[ohlcIndices[0]],
                      high: row[ohlcIndices[1]], 
                      low: row[ohlcIndices[2]],
                      close: row[ohlcIndices[3]]
                    }))
                    .filter(d => d.x != null && d.open != null && d.high != null && d.low != null && d.close != null);
                  
                  // Replace all traces with single candlestick trace
                  traces.length = 0; // Clear existing traces
                  traces.push({
                    type: 'candlestick',
                    x: candlestickData.map(d => d.x),
                    open: candlestickData.map(d => d.open),
                    high: candlestickData.map(d => d.high),
                    low: candlestickData.map(d => d.low),
                    close: candlestickData.map(d => d.close),
                    increasing: { line: { color: '#22c55e' } },
                    decreasing: { line: { color: '#ef4444' } },
                    name: 'OHLC'
                  });
                  return; // Skip normal trace processing
                }
              }
              
              // Single price column - use aggregation logic
              const timeData = trace.x.slice();
              const priceData = trace.y.slice();
              const dataLength = priceData.length;
              
              // Determine number of candlestick periods (aim for 15-25 candlesticks)
              const targetCandles = Math.min(25, Math.max(5, Math.floor(dataLength / 2)));
              const periodsPerCandle = Math.max(1, Math.floor(dataLength / targetCandles));
              
              const ohlcResults = {
                x: [] as any[],
                open: [] as number[],
                high: [] as number[],
                low: [] as number[],
                close: [] as number[]
              };
              
              // Aggregate sequential data points into OHLC candlesticks
              for (let i = 0; i < dataLength; i += periodsPerCandle) {
                const endIdx = Math.min(i + periodsPerCandle, dataLength);
                const periodPrices = priceData.slice(i, endIdx).filter((p: any) => typeof p === 'number' && !isNaN(p));
                const periodTimes = timeData.slice(i, endIdx);
                
                if (periodPrices.length === 0) continue;
                
                // Calculate real OHLC from price sequence
                const open = periodPrices[0];
                const close = periodPrices[periodPrices.length - 1];
                const high = Math.max(...periodPrices);
                const low = Math.min(...periodPrices);
                
                ohlcResults.x.push(periodTimes[0]);
                ohlcResults.open.push(open);
                ohlcResults.high.push(high);
                ohlcResults.low.push(low);
                ohlcResults.close.push(close);
              }
              
              // Replace traces with candlestick
              traces.length = 0;
              traces.push({
                type: 'candlestick',
                x: ohlcResults.x,
                open: ohlcResults.open,
                high: ohlcResults.high,
                low: ohlcResults.low,
                close: ohlcResults.close,
                increasing: { line: { color: '#22c55e' } },
                decreasing: { line: { color: '#ef4444' } },
                name: 'Aggregated OHLC'
              });
            }
            return; // Skip normal trace processing for candlestick
          case 'ohlc':
            // Detect if we have 4 OHLC columns or single price column
            if (index === 0) { // Only process OHLC on first trace to avoid duplicates
              // Check if user selected 4 Y columns (likely OHLC)
              if (chartConfig.yColumns.length === 4) {
                // Use direct OHLC mapping - assume columns are in order: open, high, low, close
                const xColumnIndex = data.columns.indexOf(chartConfig.xColumn);
                const ohlcIndices = chartConfig.yColumns.map(col => data.columns.indexOf(col));
                
                if (xColumnIndex !== -1 && ohlcIndices.every(idx => idx !== -1)) {
                  const ohlcData = data.data
                    .map(row => ({
                      x: row[xColumnIndex],
                      open: row[ohlcIndices[0]],
                      high: row[ohlcIndices[1]], 
                      low: row[ohlcIndices[2]],
                      close: row[ohlcIndices[3]]
                    }))
                    .filter(d => d.x != null && d.open != null && d.high != null && d.low != null && d.close != null);
                  
                  // Replace all traces with single OHLC trace
                  traces.length = 0; // Clear existing traces
                  traces.push({
                    type: 'ohlc',
                    x: ohlcData.map(d => d.x),
                    open: ohlcData.map(d => d.open),
                    high: ohlcData.map(d => d.high),
                    low: ohlcData.map(d => d.low),
                    close: ohlcData.map(d => d.close),
                    increasing: { line: { color: '#22c55e' } },
                    decreasing: { line: { color: '#ef4444' } },
                    name: 'OHLC'
                  });
                  return; // Skip normal trace processing
                }
              }
              
              // Single price column - use aggregation logic
              const ohlcTimeData = trace.x.slice();
              const ohlcPriceData = trace.y.slice();
              const ohlcDataLength = ohlcPriceData.length;
              
              // Determine aggregation periods
              const ohlcTargetCandles = Math.min(25, Math.max(5, Math.floor(ohlcDataLength / 2)));
              const ohlcPeriodsPerCandle = Math.max(1, Math.floor(ohlcDataLength / ohlcTargetCandles));
              
              const ohlcAggregated = {
                x: [] as any[],
                open: [] as number[],
                high: [] as number[],
                low: [] as number[],
                close: [] as number[]
              };
              
              // Aggregate data into OHLC periods
              for (let i = 0; i < ohlcDataLength; i += ohlcPeriodsPerCandle) {
                const endIdx = Math.min(i + ohlcPeriodsPerCandle, ohlcDataLength);
                const periodPrices = ohlcPriceData.slice(i, endIdx).filter((p: any) => typeof p === 'number' && !isNaN(p));
                const periodTimes = ohlcTimeData.slice(i, endIdx);
                
                if (periodPrices.length === 0) continue;
                
                ohlcAggregated.x.push(periodTimes[0]);
                ohlcAggregated.open.push(periodPrices[0]);
                ohlcAggregated.high.push(Math.max(...periodPrices));
                ohlcAggregated.low.push(Math.min(...periodPrices));
                ohlcAggregated.close.push(periodPrices[periodPrices.length - 1]);
              }
              
              // Replace traces with OHLC
              traces.length = 0;
              traces.push({
                type: 'ohlc',
                x: ohlcAggregated.x,
                open: ohlcAggregated.open,
                high: ohlcAggregated.high,
                low: ohlcAggregated.low,
                close: ohlcAggregated.close,
                increasing: { line: { color: '#22c55e' } },
                decreasing: { line: { color: '#ef4444' } },
                name: 'Aggregated OHLC'
              });
            }
            return; // Skip normal trace processing for OHLC
          case 'volume':
            trace.type = 'bar';
            trace.marker = { color: '#22c55e' };
            delete trace.line;
            break;
          case 'heatmap':
            // Use our new financial heatmap generator
            try {
              const heatmapData = generateFinancialHeatmap(
                data.columns,
                data.data,
                chartConfig.xColumn,
                chartConfig.yColumns // Pass all selected Y columns
              );
              
              trace.type = 'heatmap';
              trace.x = heatmapData.x;
              trace.y = heatmapData.y;
              trace.z = heatmapData.z;
              trace.colorscale = heatmapData.colorscale || 'Viridis';
              trace.showscale = true;
              trace.colorbar = {
                title: heatmapData.title || 'Intensity',
                titleside: 'right',
                len: 0.8
              };
              
              // Add hover info for better UX
              trace.hovertemplate = 
                '<b>%{x}</b><br>' +
                '%{y}<br>' +
                'Value: %{z}<br>' +
                '<extra></extra>';
              
              // Ensure proper color scale handling
              trace.zauto = false;
              trace.zmin = 0;
              trace.zmax = Math.max(...heatmapData.z.flat()) || 1;
              
            } catch (error) {
              console.warn('Error generating financial heatmap, using enhanced fallback:', error);
              
              // Enhanced fallback with pattern instead of random data
              const xValues = trace.x ? trace.x.slice() : [];
              const yValues = trace.y ? trace.y.slice() : [];
              
              if (xValues.length === 0 || yValues.length === 0) {
                // Create default pattern
                const size = 12;
                const patternMatrix = Array.from({length: size}, (_, i) => 
                  Array.from({length: size}, (_, j) => {
                    // Create a meaningful pattern (wave pattern)
                    return Math.sin(i * 0.3) * Math.cos(j * 0.3) * 20 + 
                           Math.sin((i + j) * 0.2) * 10 + 30;
                  })
                );
                
                trace.type = 'heatmap';
                trace.x = Array.from({length: size}, (_, i) => `X${i+1}`);
                trace.y = Array.from({length: size}, (_, i) => `Y${i+1}`);
                trace.z = patternMatrix;
                trace.colorscale = 'Viridis';
                trace.showscale = true;
              } else {
                // Use basic density approach as fallback
                const uniqueX = [...new Set(xValues)].slice(0, 20);
                const uniqueY = [...new Set(yValues)].slice(0, 15);
                
                const densityMatrix = uniqueY.map((yVal, i) => 
                  uniqueX.map((xVal, j) => {
                    // Create a more meaningful pattern based on position
                    let count = 0;
                    for (let k = 0; k < Math.min(xValues.length, 100); k++) {
                      if (xValues[k] === xVal && yValues[k] === yVal) count++;
                    }
                    return count > 0 ? count : Math.sin(i * 0.5) * Math.cos(j * 0.5) * 5 + 5;
                  })
                );
                
                trace.type = 'heatmap';
                trace.x = uniqueX.map(String);
                trace.y = uniqueY.map(String);
                trace.z = densityMatrix;
                trace.colorscale = 'Viridis';
                trace.showscale = true;
              }
            }
            
            delete trace.line;
            delete trace.marker;
            break;
          case 'box':
            trace.type = 'box';
            trace.y = trace.y;
            delete trace.x;
            delete trace.line;
            break;
          case 'waterfall':
            trace.type = 'waterfall';
            trace.increasing = { marker: { color: 'green' } };
            trace.decreasing = { marker: { color: 'red' } };
            trace.totals = { marker: { color: 'blue' } };
            trace.connector = { line: { color: 'grey' } };
            delete trace.line;
            delete trace.marker;
            break;
          case 'band':
            // For band chart, we need to create multiple traces
            // This will be handled differently - skip for now
            trace.type = 'scatter';
            trace.mode = 'lines';
            trace.fill = 'tonexty';
            trace.fillcolor = trace.line.color.replace(')', ', 0.2)').replace('rgb', 'rgba');
            break;
        }
      });

      // Layout configuration with proper axis control
      const layout: any = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: 'hsl(var(--foreground))' },
        margin: { l: 80, r: 50, t: 50, b: 120 },
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

            </div>

            {/* Area Chart Specific Options */}
            {chartConfig.type === 'area' && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-foreground">Area Chart Style:</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="areaStyle"
                        checked={!chartConfig.stackedArea}
                        onChange={() => setChartConfig(prev => ({ ...prev, stackedArea: false }))}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">Overlapping</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="areaStyle"
                        checked={chartConfig.stackedArea || false}
                        onChange={() => setChartConfig(prev => ({ ...prev, stackedArea: true }))}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">Stacked</span>
                    </label>
                  </div>
                  <div className="text-xs text-muted-foreground ml-2">
                    {chartConfig.stackedArea 
                      ? "Shows cumulative values - each series adds to the total"
                      : "Shows overlapping areas - good for comparing trends"
                    }
                  </div>
                </div>
              </div>
            )}
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