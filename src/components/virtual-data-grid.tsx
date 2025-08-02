import { useMemo, useState, useRef } from 'react';
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
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KdbQueryResult } from '@/types/kdb';

interface VirtualDataGridProps {
  data: KdbQueryResult | null;
  isLoading: boolean;
  onPageChange?: (offset: number, limit: number) => void;
  currentPage?: number;
  pageSize?: number;
  totalRows?: number;
  clientSidePagination?: boolean; // Enable client-side pagination
}

export function VirtualDataGrid({ 
  data, 
  isLoading, 
  onPageChange, 
  currentPage = 0, 
  pageSize = 10000,
  totalRows = 0,
  clientSidePagination = true
}: VirtualDataGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [clientPage, setClientPage] = useState(0);
  const [clientPageSize, setClientPageSize] = useState(10000);
  
  // Ref for virtual scrolling
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!data || !data.columns) return [];
    
    return data.columns.map((columnName, index) => ({
      accessorKey: index.toString(),
      header: columnName,
      size: 150, // Default column width
      minSize: 50, // Minimum column width
      maxSize: 500, // Maximum column width
      enableResizing: true,
      cell: ({ getValue }) => {
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
    }));
  }, [data]);

  const tableData = useMemo(() => {
    if (!data || !data.data) return [];
    const allData = data.data.map((row, rowIndex) => {
      const rowObj: Record<string, any> = {};
      row.forEach((cell, cellIndex) => {
        rowObj[cellIndex.toString()] = cell;
      });
      rowObj._id = rowIndex;
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
  const totalDataRows = data?.data?.length || 0;
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
  
  const currentDisplayPage = clientSidePagination ? clientPage : currentPage;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No data available</p>
          <p className="text-sm">Select a table from the sidebar to view its data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Search and Info Bar */}
      <div className="p-2 border-b border-border bg-card">
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
        className="flex-1 overflow-auto relative"
        style={{ maxHeight: 'calc(100vh - 250px)' }}
      >
        <table className="w-full table-fixed" style={{ width: table.getTotalSize() }}>
          {/* Sticky Header */}
          <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-r border-border"
                    style={{ width: header.column.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          className={`flex items-center space-x-1 ${
                            header.column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground' : ''
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
                  className={`hover:bg-muted/50 transition-colors ${
                    virtualRow.index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  }`}
                  style={{ height: `${virtualRow.size}px` }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 text-sm text-foreground border-r border-border"
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
    </div>
  );
}