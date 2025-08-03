import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
  type ColumnDef,
  ColumnResizeMode,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsUp, ChevronsDown, Search, Database, Loader2, BarChart3, Download, Settings, GripVertical, PanelLeft, Home, MoveDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColumnManagementModal } from '@/components/column-management-modal';
import { KdbQueryResult } from '@/types/kdb';

interface VirtualDataGridProps {
  data: KdbQueryResult | null;
  isLoading: boolean;
  onPageChange?: (offset: number, limit: number) => void;
  currentPage?: number;
  pageSize?: number;
  totalRows?: number;
  clientSidePagination?: boolean; // Enable client-side pagination
  onOpenChart?: () => void;
  hasData?: boolean;
  enableColumnControls?: boolean;
  isSidebarVisible?: boolean;
  onShowSidebar?: () => void;
}

export function VirtualDataGrid({ 
  data, 
  isLoading, 
  onPageChange, 
  currentPage = 0, 
  pageSize = 10000,
  totalRows = 0,
  clientSidePagination = true,
  onOpenChart,
  hasData = false,
  enableColumnControls = false,
  isSidebarVisible = true,
  onShowSidebar
}: VirtualDataGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [clientPage, setClientPage] = useState(0);
  const [clientPageSize, setClientPageSize] = useState(10000);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropdownDraggedColumn, setDropdownDraggedColumn] = useState<string | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  
  // Enhanced drag & drop state
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);
  
  // State for dynamic height measurement
  const [containerHeight, setContainerHeight] = useState<number>(400); // fallback height
  
  // Ref for virtual scrolling
  const tableContainerRef = useRef<HTMLDivElement>(null);
  // Ref for ResizeObserver
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Initialize column order when data changes
  React.useEffect(() => {
    if (data?.columns) {
      setColumnOrder(['__row_number__', ...data.columns.map((_, index) => index.toString())]);
    }
  }, [data]);

  // Dynamic height measurement for virtual scrolling
  useLayoutEffect(() => {
    const measureContainer = () => {
      if (tableContainerRef.current) {
        const parentElement = tableContainerRef.current.parentElement;
        if (parentElement) {
          // Get the available height from the parent container
          const parentRect = parentElement.getBoundingClientRect();
          const containerRect = tableContainerRef.current.getBoundingClientRect();
          
          // Calculate the height by finding how much space is above this container
          const headerHeight = containerRect.top - parentRect.top;
          const availableHeight = parentRect.height - headerHeight;
          
          // Ensure minimum height and apply measurement
          const measuredHeight = Math.max(200, Math.floor(availableHeight - 8)); // -8px for margin/padding
          setContainerHeight(measuredHeight);
        }
      }
    };

    // Initial measurement
    measureContainer();

    // Setup ResizeObserver for dynamic updates
    if (tableContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Debounce the measurement to avoid excessive updates
          setTimeout(measureContainer, 10);
        }
      });

      // Observe the container's parent for size changes
      const parentElement = tableContainerRef.current.parentElement;
      if (parentElement) {
        resizeObserverRef.current.observe(parentElement);
      }
    }

    // Cleanup function
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [data]); // Re-run when data changes to ensure proper measurement

  // Enhanced Drag & Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData('text/plain', columnId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedColumn(columnId);
    
    // Clear any previous drag over states
    setDragOverColumn(null);
    setDropPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Skip if dragging over the same column or no column is being dragged
    if (!draggedColumn || draggedColumn === targetColumnId) return;
    
    // Calculate drop position based on mouse position within the column
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX;
    const columnCenter = rect.left + rect.width / 2;
    const position = mouseX < columnCenter ? 'left' : 'right';
    
    setDragOverColumn(targetColumnId);
    setDropPosition(position);
  };

  const handleDragEnter = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) return;
    
    // Set initial hover state
    setDragOverColumn(targetColumnId);
  };

  const handleDragLeave = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    
    // Only clear if we're actually leaving this column (not moving to a child element)
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    if (mouseX < rect.left || mouseX > rect.right || mouseY < rect.top || mouseY > rect.bottom) {
      if (dragOverColumn === targetColumnId) {
        setDragOverColumn(null);
        setDropPosition(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const draggedColumnId = e.dataTransfer.getData('text/plain');
    
    if (draggedColumnId && draggedColumnId !== targetColumnId) {
      // Use drop position for more intelligent reordering
      reorderColumns(draggedColumnId, targetColumnId, dropPosition);
    }
    
    // Clear all drag states
    setDraggedColumn(null);
    setDragOverColumn(null);
    setDropPosition(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Clear all drag states
    setDraggedColumn(null);
    setDragOverColumn(null);
    setDropPosition(null);
  };

  // Enhanced Column Reordering Logic with Position Awareness
  const reorderColumns = (draggedId: string, targetId: string, position: 'left' | 'right' | null = null) => {
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedId);
      const targetIndex = newOrder.indexOf(targetId);
      
      // Remove dragged item
      const [draggedItem] = newOrder.splice(draggedIndex, 1);
      
      // Calculate insertion position based on drop position
      let insertIndex = targetIndex;
      
      if (position === 'right') {
        // Insert after the target column
        insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + 1;
      } else {
        // Insert before the target column (default behavior)
        insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      }
      
      // Ensure insertion index is within bounds
      insertIndex = Math.max(0, Math.min(newOrder.length, insertIndex));
      
      // Insert at calculated position
      newOrder.splice(insertIndex, 0, draggedItem);
      
      return newOrder;
    });
  };

  // Dropdown Drag & Drop Event Handlers
  const handleDropdownDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData('text/plain', columnId);
    e.dataTransfer.effectAllowed = 'move';
    setDropdownDraggedColumn(columnId);
    
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.6';
    }
  };

  const handleDropdownDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropdownDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const draggedColumnId = e.dataTransfer.getData('text/plain');
    
    if (draggedColumnId && draggedColumnId !== targetColumnId) {
      reorderColumns(draggedColumnId, targetColumnId);
    }
    
    setDropdownDraggedColumn(null);
    
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDropdownDragEnd = (e: React.DragEvent) => {
    setDropdownDraggedColumn(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const resetColumnOrder = () => {
    if (data?.columns) {
      setColumnOrder(data.columns.map((_, index) => index.toString()));
    }
  };

  // CSV Export function
  const exportToCSV = () => {
    if (!data || !data.data.length) return;
    
    const visibleColumns = table.getVisibleLeafColumns();
    const filteredRows = table.getFilteredRowModel().rows;
    
    // Generate headers
    const headers = visibleColumns.map(col => {
      const header = col.columnDef.header;
      return typeof header === 'string' ? header : data.columns[parseInt(col.id)];
    });
    
    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...filteredRows.map(row => 
        visibleColumns.map(col => {
          const value = row.getValue(col.id);
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          // Escape values containing commas, quotes, or newlines
          return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"` 
            : stringValue;
        }).join(',')
      )
    ].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kdb-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculate basic values first
  const totalDataRows = data?.data?.length || 0;
  const currentDisplayPage = clientSidePagination ? clientPage : currentPage;

  // Smart time-only column detection utility
  const isTimeOnlyColumn = (columnIndex: number): boolean => {
    if (!data || !data.data || !data.columns) return false;
    
    const columnName = data.columns[columnIndex]?.toLowerCase();
    const sampleSize = Math.min(20, data.data.length); // Check first 20 rows
    const sampleData = data.data.slice(0, sampleSize);
    
    let stringCount = 0;
    let timeOnlyPatternCount = 0;
    
    for (const row of sampleData) {
      const value = row[columnIndex];
      if (typeof value === 'string' && value.length >= 12) {
        stringCount++;
        
        // Check if this looks like a KDB+ time-only serialization
        // Pattern: starts with "2000-01-01T" AND doesn't vary in date part
        if (value.startsWith('2000-01-01T')) {
          timeOnlyPatternCount++;
        }
      }
    }
    
    // Only consider it time-only if:
    // 1. Column name suggests time-only (not timestamp/datetime)
    // 2. ALL string values use the 2000-01-01 pattern (KDB+ time serialization)
    // 3. Reasonable sample size
    const hasTimeOnlyName = columnName && 
      (columnName === 'time' || columnName === 't') && 
      !columnName.includes('stamp') && 
      !columnName.includes('date');
    
    const allValuesAreTimeOnly = stringCount > 0 && 
      timeOnlyPatternCount === stringCount && 
      stringCount >= Math.min(5, sampleSize);
    
    return hasTimeOnlyName && allValuesAreTimeOnly;
  };

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!data || !data.columns || columnOrder.length === 0) return [];
    
    // Ultra-conservative width calculation to prevent cropping
    const maxRowNumber = clientSidePagination ? totalDataRows : totalRows;
    const digits = Math.max(1, (maxRowNumber || 1).toString().length);
    const characterWidthAt06rem = 7.0; // More conservative width for 0.6rem JetBrains Mono
    const overhead = 40; // padding(22) + border(2) + extra safety margin(16)
    const preciseWidth = Math.ceil(digits * characterWidthAt06rem + overhead);
    const rowNumberWidth = Math.max(45, Math.min(160, preciseWidth));
    
    // Row number column (always first)
    const rowNumberColumn: ColumnDef<any> = {
      id: '__row_number__',
      header: () => (
        <div className="row-number-header" title="Row number"></div>
      ),
      size: rowNumberWidth,
      minSize: 45, // Minimum for comfortable display with padding
      maxSize: 160, // Maximum for very large datasets  
      enableResizing: true,
      enableSorting: false,
      enableColumnFilter: false,
      enableGlobalFilter: false,
      enableHiding: false,
      cell: ({ row }) => {
        // For static row numbers, use the original dataset position
        const originalIndex = row.original._originalRowIndex;
        const rowNumber = originalIndex + 1; // Simple 1-based numbering from original dataset
        
        return (
          <div className="row-number-cell" title={`Row ${rowNumber}`}>
            {rowNumber}
          </div>
        );
      }
    };
    
    const dataColumns = columnOrder
      .filter(colId => colId !== '__row_number__') // Exclude row number column
      .map((colId) => {
        const index = parseInt(colId);
        const columnName = data.columns[index];
      
      return {
        id: colId,
        accessorKey: colId,
        header: ({ column }: any) => (
          <div 
            className={`flex items-center space-x-2 ${
              draggedColumn === colId ? 'opacity-60' : ''
            }`}
          >
            {enableColumnControls && (
              <GripVertical className="h-2.5 w-2.5 text-muted-foreground hover:text-primary transition-colors" />
            )}
            <span className="truncate">{columnName}</span>
            {column.getCanSort() && (
              <span className="text-muted-foreground">
                {column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="h-2.5 w-2.5" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ChevronDown className="h-2.5 w-2.5" />
                ) : (
                  <div className="h-2.5 w-2.5" />
                )}
              </span>
            )}
            {/* Visual insertion indicator */}
            {dragOverColumn === colId && dropPosition && (
              <div 
                className={`absolute top-0 bottom-0 w-1 bg-primary z-20 ${
                  dropPosition === 'left' ? 'left-0' : 'right-0'
                }`}
              />
            )}
          </div>
        ),
        size: 150, // Default column width
        minSize: 50, // Minimum column width
        maxSize: 500, // Maximum column width
        enableResizing: true,
        cell: ({ getValue }: any) => {
          const value = getValue();
          if (value === null || value === undefined) return '-';
          if (typeof value === 'number') {
            return value.toLocaleString();
          }
          if (typeof value === 'string') {
            // Smart timestamp handling - only strip date for confirmed time-only columns
            if (value.startsWith('2000-01-01T') && value.length >= 23 && isTimeOnlyColumn(index)) {
              // Extract just the time portion HH:MM:SS.mmm for confirmed time-only columns
              return value.substring(11, 23);
            }
            // For actual timestamps, preserve full datetime display
            if (value.startsWith('2000-01-01T') || value.match(/^\d{4}-\d{2}-\d{2}T/)) {
              // Format timestamp for better readability: "2024-01-15 14:30:25.123"
              return value.replace('T', ' ').replace('Z', '');
            }
            if (value.length > 50) {
              return (
                <span title={value}>
                  {value.substring(0, 50) + '...'}
                </span>
              );
            }
          }
          return String(value);
        },
      };
    });
    
    // Return row number column first, followed by data columns
    return [rowNumberColumn, ...dataColumns];
  }, [data, columnOrder, enableColumnControls, draggedColumn, dragOverColumn, dropPosition, handleDragStart, handleDragOver, handleDragEnter, handleDragLeave, handleDrop, handleDragEnd, clientSidePagination, clientPage, clientPageSize, currentDisplayPage, pageSize, totalDataRows, totalRows]);

  const tableData = useMemo(() => {
    if (!data || !data.data) return [];
    const allData = data.data.map((row, rowIndex) => {
      const rowObj: Record<string, any> = {};
      row.forEach((cell, cellIndex) => {
        rowObj[cellIndex.toString()] = cell;
      });
      // Store original index that will never change regardless of sorting
      rowObj._originalRowIndex = rowIndex;
      rowObj._id = rowIndex; // Keep for backward compatibility
      return rowObj;
    });
    
    // Apply client-side pagination if enabled
    if (clientSidePagination && allData.length > clientPageSize) {
      const start = clientPage * clientPageSize;
      const end = start + clientPageSize;
      return allData.slice(start, end);
    }
    
    return allData;
  }, [data, clientPage, clientPageSize, clientSidePagination]);

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    enableColumnResizing: true,
    columnResizeMode: 'onChange' as ColumnResizeMode,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      columnOrder,
    },
  });

  // Virtual row model
  const { rows } = table.getRowModel();
  
  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40, // Estimated row height
    overscan: 20, // Increased overscan to ensure more rows are rendered beyond viewport
  });

  // Update virtualizer when container height changes
  React.useEffect(() => {
    if (rowVirtualizer && tableContainerRef.current) {
      rowVirtualizer.measure();
    }
  }, [containerHeight, rowVirtualizer]);


  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  

  // Calculate total pages based on mode
  const totalPages = clientSidePagination && totalDataRows > 0
    ? Math.ceil(totalDataRows / clientPageSize)
    : Math.ceil(totalRows / pageSize);

  const handlePageChange = (newPage: number) => {
    if (clientSidePagination) {
      // Client-side pagination
      if (newPage >= 0 && newPage < totalPages) {
        setClientPage(newPage);
      }
    } else if (onPageChange && newPage >= 0 && newPage < totalPages) {
      // Server-side pagination
      onPageChange(newPage * pageSize, pageSize);
    }
  };

  // Navigation helper functions
  const scrollToTop = () => {
    if (rows.length > 0) {
      rowVirtualizer.scrollToIndex(0, { align: 'start' });
    }
  };

  const scrollToBottom = () => {
    if (rows.length > 0) {
      // Use align: 'end' and force the virtualizer to include the last row
      rowVirtualizer.scrollToIndex(rows.length - 1, { align: 'end' });
      
      // Fallback: scroll to bottom of container if virtualizer doesn't reach end
      setTimeout(() => {
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const calculateVisibleRows = () => {
    if (!tableContainerRef.current) return 10; // fallback
    const containerHeight = tableContainerRef.current.clientHeight;
    const estimatedRowHeight = 40; // matches the virtualizer estimateSize
    return Math.floor(containerHeight / estimatedRowHeight) - 2; // -2 for padding
  };

  const scrollPageUp = () => {
    const visibleRows = calculateVisibleRows();
    const currentTopIndex = virtualRows.length > 0 ? virtualRows[0].index : 0;
    const targetIndex = Math.max(0, currentTopIndex - visibleRows);
    rowVirtualizer.scrollToIndex(targetIndex, { align: 'start' });
  };

  const scrollPageDown = () => {
    const visibleRows = calculateVisibleRows();
    const currentTopIndex = virtualRows.length > 0 ? virtualRows[0].index : 0;
    const targetIndex = Math.min(rows.length - 1, currentTopIndex + visibleRows);
    rowVirtualizer.scrollToIndex(targetIndex, { align: 'start' });
  };

  // Keyboard event handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle navigation keys when the table container is focused
    switch (e.key) {
      case 'Home':
        e.preventDefault();
        scrollToTop();
        break;
      case 'End':
        e.preventDefault();
        scrollToBottom();
        break;
      case 'PageUp':
        e.preventDefault();
        scrollPageUp();
        break;
      case 'PageDown':
        e.preventDefault();
        scrollPageDown();
        break;
      default:
        break;
    }
  };

  // Check if we're at top or bottom for button states
  const isAtTop = virtualRows.length > 0 ? virtualRows[0].index === 0 : true;
  const isAtBottom = virtualRows.length > 0 ? 
    virtualRows[virtualRows.length - 1].index >= rows.length - 1 : true;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg mb-2">No data available</p>
          <p className="text-sm max-w-md">
            {!data ? 
              "Connect to a KDB+ server and select a table or execute a query to view data." :
              "The selected table or query returned no results."
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-grid-container flex-1 flex flex-col">
      {/* Search and Info Bar */}
      <div className="card-header-enhanced p-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in data..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-sm text-muted-foreground">
                {clientSidePagination && totalDataRows > clientPageSize ? (
                  <>
                    Showing {Math.min(clientPageSize, rows.length).toLocaleString()} rows
                    {` (page ${clientPage + 1} of ${totalPages})`}
                    {` from ${totalDataRows.toLocaleString()} total`}
                  </>
                ) : (
                  <>
                    Showing {rows.length.toLocaleString()} rows
                    {totalDataRows > 0 && ` of ${totalDataRows.toLocaleString()} total`}
                  </>
                )}
                {globalFilter && ` (filtered)`}
              </div>
              
              {/* Action Icons */}
              <div className="flex items-center space-x-1 ml-4">
                {/* Show Sidebar Button - only when sidebar is hidden and onShowSidebar is available */}
                {!isSidebarVisible && onShowSidebar && (
                  <button
                    onClick={onShowSidebar}
                    className="sidebar-toggle-btn p-1.5 text-muted-foreground hover:text-primary rounded"
                    title={`Show Tables Panel (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+B)`}
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                )}
                
                {/* Navigation Controls */}
                {hasData && rows.length > 10 && (
                  <div className="flex items-center space-x-1 border-r border-border pr-2 mr-2">
                    <button
                      onClick={scrollToTop}
                      disabled={isAtTop}
                      className="nav-button btn-financial-secondary p-1.5 rounded"
                      title="Go to beginning (Home key)"
                    >
                      <Home className="h-4 w-4" />
                    </button>
                    <button
                      onClick={scrollPageUp}
                      disabled={isAtTop}
                      className="nav-button btn-financial-secondary p-1.5 rounded"
                      title="Page up (Page Up key)"
                    >
                      <ChevronsUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={scrollPageDown}
                      disabled={isAtBottom}
                      className="nav-button btn-financial-secondary p-1.5 rounded"
                      title="Page down (Page Down key)"
                    >
                      <ChevronsDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={scrollToBottom}
                      disabled={isAtBottom}
                      className="nav-button btn-financial-secondary p-1.5 rounded"
                      title="Go to end (End key)"
                    >
                      <MoveDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
                
                {hasData && (
                  <>
                    {/* Chart Button */}
                  {onOpenChart && (
                    <button
                      onClick={onOpenChart}
                      className="icon-3d icon-3d-chart p-2 rounded-md"
                      title="Open Chart Visualization"
                    >
                      <BarChart3 className="h-5 w-5" />
                    </button>
                  )}
                  
                  {/* CSV Export Button */}
                  <button
                    onClick={exportToCSV}
                    className="icon-3d icon-3d-export p-2 rounded-md"
                    title="Export Data as CSV"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  
                  {/* Column Management Button */}
                  {enableColumnControls && (
                    <button
                      onClick={() => setIsColumnModalOpen(true)}
                      className="icon-3d icon-3d-settings p-2 rounded-md"
                      title="Manage Columns"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                  )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Page Size Selector for Client-Side Pagination */}
          {clientSidePagination && totalDataRows > 100 && (
            <select
              value={clientPageSize}
              onChange={(e) => {
                setClientPageSize(Number(e.target.value));
                setClientPage(0); // Reset to first page
              }}
              className="px-3 py-1 text-sm border border-border rounded-md bg-background text-foreground mr-4"
            >
              <option value={100}>100 rows/page</option>
              <option value={500}>500 rows/page</option>
              <option value={1000}>1,000 rows/page</option>
              <option value={5000}>5,000 rows/page</option>
              <option value={10000}>10,000 rows/page</option>
              <option value={50000}>50,000 rows/page</option>
              <option value={totalDataRows}>All rows</option>
            </select>
          )}
          
          {/* Pagination Controls */}
          {((clientSidePagination && totalDataRows > clientPageSize) || 
            (!clientSidePagination && totalRows > 0 && totalPages > 1 && onPageChange)) && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(0)}
                disabled={currentDisplayPage === 0}
                title="First page"
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentDisplayPage - 1)}
                disabled={currentDisplayPage === 0}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center space-x-1">
                <span className="text-sm text-muted-foreground">Page</span>
                <span className="text-sm font-medium">
                  {currentDisplayPage + 1} of {totalPages}
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentDisplayPage + 1)}
                disabled={currentDisplayPage >= totalPages - 1}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages - 1)}
                disabled={currentDisplayPage >= totalPages - 1}
                title="Last page"
              >
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Virtual Scrolling Container */}
      <div 
        ref={tableContainerRef}
        className="overflow-auto relative enhanced-scrollbar focus:outline-none focus:ring-2 focus:ring-primary/50"
        style={{ height: `${containerHeight}px` }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="grid"
        aria-label="Data table with keyboard navigation"
      >
        <table className="w-full table-fixed" style={{ width: table.getTotalSize() }}>
          {/* Sticky Header */}
          <thead className="data-table-header sticky top-0 z-10 backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isRowNumber = header.column.id === '__row_number__';
                  const isDraggable = enableColumnControls && !isRowNumber;
                  const isBeingDragged = draggedColumn === header.column.id;
                  const isDropTarget = dragOverColumn === header.column.id;
                  
                  return (
                  <th
                    key={header.id}
                    className={`data-table-cell relative text-left text-sm font-semibold text-foreground tracking-wider transition-all duration-200 ${
                      isRowNumber ? 'row-number-header-cell' : ''
                    } ${
                      isDraggable ? 'cursor-move' : ''
                    } ${
                      isBeingDragged ? 'opacity-60 scale-95' : ''
                    } ${
                      isDropTarget ? 'bg-primary/10' : ''
                    }`}
                    style={{ width: header.column.getSize() }}
                    draggable={isDraggable}
                    onDragStart={isDraggable ? (e) => handleDragStart(e, header.column.id) : undefined}
                    onDragOver={isDraggable ? (e) => handleDragOver(e, header.column.id) : undefined}
                    onDragEnter={isDraggable ? (e) => handleDragEnter(e, header.column.id) : undefined}
                    onDragLeave={isDraggable ? (e) => handleDragLeave(e, header.column.id) : undefined}
                    onDrop={isDraggable ? (e) => handleDrop(e, header.column.id) : undefined}
                    onDragEnd={isDraggable ? handleDragEnd : undefined}
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          className={`flex items-center space-x-1 ${
                            header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary transition-colors' : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {header.column.getCanSort() && (
                            <span className="text-muted-foreground">
                              {header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="h-2.5 w-2.5" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-2.5 w-2.5" />
                              ) : (
                                <div className="h-2.5 w-2.5" />
                              )}
                            </span>
                          )}
                        </div>
                        {/* Column Resize Handle */}
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50 ${
                            header.column.getIsResizing() ? 'bg-primary' : ''
                          }`}
                        />
                      </>
                    )}
                  </th>
                );
                })}
              </tr>
            ))}
          </thead>
          
          {/* Virtual Table Body */}
          <tbody>
            {/* Spacer for virtual scrolling */}
            {virtualRows.length > 0 && virtualRows[0]?.index > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: virtualRows[0].start }} />
              </tr>
            )}
            
            {/* Visible rows */}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  className="data-table-row transition-colors"
                  style={{ height: `${virtualRow.size}px` }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="data-table-cell px-4 py-2 text-sm text-foreground"
                      style={{ width: cell.column.getSize() }}
                    >
                      <div className="truncate" title={String(cell.getValue())}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
            
            {/* Bottom spacer for virtual scrolling */}
            {virtualRows.length > 0 && (
              <tr>
                <td 
                  colSpan={columns.length} 
                  style={{ 
                    height: Math.max(0, totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)) + 100 // Extra 100px padding
                  }} 
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Column Management Modal */}
      <ColumnManagementModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columnOrder={columnOrder}
        table={table}
        data={data}
        dropdownDraggedColumn={dropdownDraggedColumn}
        handleDropdownDragStart={handleDropdownDragStart}
        handleDropdownDragOver={handleDropdownDragOver}
        handleDropdownDrop={handleDropdownDrop}
        handleDropdownDragEnd={handleDropdownDragEnd}
        resetColumnOrder={resetColumnOrder}
      />
    </div>
  );
}