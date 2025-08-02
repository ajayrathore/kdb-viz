import React, { useMemo, useState, useRef } from 'react';
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
  
  // Ref for virtual scrolling
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Initialize column order when data changes
  React.useEffect(() => {
    if (data?.columns) {
      setColumnOrder(['__row_number__', ...data.columns.map((_, index) => index.toString())]);
    }
  }, [data]);

  // Drag & Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData('text/plain', columnId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedColumn(columnId);
    
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const draggedColumnId = e.dataTransfer.getData('text/plain');
    
    if (draggedColumnId && draggedColumnId !== targetColumnId) {
      reorderColumns(draggedColumnId, targetColumnId);
    }
    
    setDraggedColumn(null);
    
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedColumn(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  // Column Reordering Logic
  const reorderColumns = (draggedId: string, targetId: string) => {
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedId);
      const targetIndex = newOrder.indexOf(targetId);
      
      // Remove dragged item
      const [draggedItem] = newOrder.splice(draggedIndex, 1);
      
      // Insert at target position
      newOrder.splice(targetIndex, 0, draggedItem);
      
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
          <div className="row-number-cell" title={`Original row ${rowNumber}`}>
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
              enableColumnControls ? 'cursor-move' : ''
            } ${draggedColumn === colId ? 'opacity-50' : ''}`}
            draggable={enableColumnControls}
            onDragStart={(e) => handleDragStart(e, colId)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, colId)}
            onDragEnd={handleDragEnd}
          >
            {enableColumnControls && (
              <GripVertical className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors" />
            )}
            <span className="truncate">{columnName}</span>
            {column.getCanSort() && (
              <span className="text-muted-foreground">
                {column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="h-3 w-3" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <div className="h-3 w-3" />
                )}
              </span>
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
            // Check if this is a time value from KDB+ (ISO string starting with 2000-01-01)
            if (value.startsWith('2000-01-01T') && value.length >= 23) {
              // Extract just the time portion HH:MM:SS.mmm
              return value.substring(11, 23);
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
  }, [data, columnOrder, enableColumnControls, draggedColumn, handleDragStart, handleDragOver, handleDrop, handleDragEnd, clientSidePagination, clientPage, clientPageSize, currentDisplayPage, pageSize, totalDataRows, totalRows]);

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
    overscan: 10, // Number of rows to render outside of viewport
  });

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
      rowVirtualizer.scrollToIndex(rows.length - 1, { align: 'end' });
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
        className="flex-1 overflow-auto relative enhanced-scrollbar focus:outline-none focus:ring-2 focus:ring-primary/50"
        style={{ maxHeight: 'calc(100vh - 250px)' }}
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
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`data-table-cell relative px-4 py-4 text-left text-sm font-semibold text-foreground tracking-wider ${
                      header.column.id === '__row_number__' ? 'row-number-header-cell' : ''
                    }`}
                    style={{ width: header.column.getSize() }}
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
                                <ChevronUp className="h-3 w-3" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <div className="h-3 w-3" />
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
                ))}
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
                    height: totalSize - (virtualRows[virtualRows.length - 1]?.end || 0) 
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