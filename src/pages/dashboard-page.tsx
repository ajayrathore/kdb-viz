import { useState, useEffect, useCallback } from 'react';
import { TableSidebar } from '@/components/table-sidebar';
import { VirtualDataGrid } from '@/components/virtual-data-grid';
import { QueryExecutorSimple } from '@/components/query-executor-simple';
import { ChartModal } from '@/components/chart-modal-plotly';
import { ConnectionInput } from '@/components/connection-input';
import { ThemeToggle } from '@/components/theme-toggle';
import { Database } from 'lucide-react';
import { KdbTable, KdbQueryResult, ConnectionStatus } from '@/types/kdb';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface DashboardPageProps {
  connectionData: { host: string; port: number } | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  tables: KdbTable[];
  onConnect: (host: string, port: number) => Promise<boolean>;
  onDisconnect: () => void;
  executeQuery: (query: string) => Promise<KdbQueryResult>;
  getTableData: (tableName: string, offset: number, limit: number) => Promise<KdbQueryResult>;
}

export function DashboardPage({
  connectionData,
  connectionStatus,
  connectionError,
  tables,
  onConnect,
  onDisconnect,
  executeQuery,
  getTableData,
}: DashboardPageProps) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [currentData, setCurrentData] = useState<KdbQueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(100);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [, setLastExecutedQuery] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const totalRows = selectedTable 
    ? tables.find(t => t.name === selectedTable)?.rowCount || 0 
    : 0;

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // Responsive behavior - auto-hide sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) { // md breakpoint
        setIsSidebarVisible(false);
      }
    };

    // Check on mount
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTableSelect = async (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentPage(0);
    setLastExecutedQuery(`select from ${tableName}`);
    await loadTableData(tableName, 0, pageSize);
  };

  const loadTableData = async (tableName: string, offset: number, limit: number) => {
    setIsLoading(true);
    try {
      const result = await getTableData(tableName, offset, limit);
      setCurrentData(result);
    } catch (error) {
      console.error('Error loading table data:', error);
      setCurrentData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (offset: number, limit: number) => {
    const newPage = Math.floor(offset / limit);
    setCurrentPage(newPage);
    if (selectedTable) {
      loadTableData(selectedTable, offset, limit);
    }
  };

  const handleExecuteQuery = async (query: string): Promise<KdbQueryResult> => {
    setIsExecuting(true);
    try {
      const result = await executeQuery(query);
      setCurrentData(result);
      setSelectedTable(null); // Clear table selection when executing custom query
      setLastExecutedQuery(query.trim());
      return result;
    } finally {
      setIsExecuting(false);
    }
  };

  // Load first table by default when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && tables.length > 0 && !selectedTable) {
      handleTableSelect(tables[0].name);
    }
  }, [tables, connectionStatus]);

  // Clear data when connection status changes
  useEffect(() => {
    if (connectionStatus !== 'connected') {
      setCurrentData(null);
      setSelectedTable(null);
      setLastExecutedQuery(null);
    }
  }, [connectionStatus, setLastExecutedQuery]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="icon-3d icon-3d-logo p-2 rounded-lg">
                <Database className="h-5 w-5" />
              </div>
              <h1 className="text-lg font-medium">KDB+ Visualizer</h1>
            </div>
            <ConnectionInput
              connectionData={connectionData}
              connectionStatus={connectionStatus}
              connectionError={connectionError}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Query Executor */}
      <QueryExecutorSimple
        onExecuteQuery={handleExecuteQuery}
        isExecuting={isExecuting}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {isSidebarVisible ? (
          <PanelGroup direction="horizontal" className="h-full">
            {/* Left Sidebar Panel */}
            <Panel defaultSize={20} minSize={15} maxSize={40}>
              <TableSidebar
                tables={tables}
                selectedTable={selectedTable}
                onTableSelect={handleTableSelect}
                onToggleSidebar={toggleSidebar}
              />
            </Panel>
            
            {/* Resize Handle */}
            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
            
            {/* Main Content Panel */}
            <Panel defaultSize={80}>
              <div className="h-full flex flex-col overflow-hidden">
                {/* Virtual Data Grid with Client-Side Pagination */}
                <VirtualDataGrid
                  data={currentData}
                  isLoading={isLoading}
                  onPageChange={selectedTable ? handlePageChange : undefined}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalRows={totalRows}
                  clientSidePagination={!selectedTable} // Use client-side for queries, server-side for tables
                  onOpenChart={() => setIsChartModalOpen(true)}
                  hasData={!!(currentData && currentData.data.length > 0)}
                  enableColumnControls={true}
                  isSidebarVisible={isSidebarVisible}
                  onShowSidebar={toggleSidebar}
                />
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          <div className="h-full flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
            {/* Virtual Data Grid - Full Width */}
            <VirtualDataGrid
              data={currentData}
              isLoading={isLoading}
              onPageChange={selectedTable ? handlePageChange : undefined}
              currentPage={currentPage}
              pageSize={pageSize}
              totalRows={totalRows}
              clientSidePagination={!selectedTable} // Use client-side for queries, server-side for tables
              onOpenChart={() => setIsChartModalOpen(true)}
              hasData={!!(currentData && currentData.data.length > 0)}
              enableColumnControls={true}
              isSidebarVisible={isSidebarVisible}
              onShowSidebar={toggleSidebar}
            />
          </div>
        )}
      </div>

      {/* Chart Modal */}
      {currentData && (
        <ChartModal
          isOpen={isChartModalOpen}
          onClose={() => setIsChartModalOpen(false)}
          data={currentData}
        />
      )}
    </div>
  );
}