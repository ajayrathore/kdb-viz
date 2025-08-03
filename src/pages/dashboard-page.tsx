import { useState, useEffect, useCallback } from 'react';
import { TableSidebar } from '@/components/table-sidebar';
import { VirtualDataGrid } from '@/components/virtual-data-grid';
import { TableMetadataDisplay } from '@/components/table-metadata-display';
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
  onConnect: (host: string, port: number, browseTables: boolean) => Promise<boolean>;
  onDisconnect: () => void;
  onCancelConnection: () => void;
  onCancelQuery: () => void;
  executeQuery: (query: string) => Promise<KdbQueryResult>;
  getTableData: (tableName: string, offset: number, limit: number) => Promise<KdbQueryResult>;
  refreshTables: () => Promise<void>;
}

export function DashboardPage({
  connectionData,
  connectionStatus,
  connectionError,
  tables,
  onConnect,
  onDisconnect,
  onCancelConnection,
  onCancelQuery,
  executeQuery,
  getTableData,
  refreshTables,
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
  const [browseTables, setBrowseTables] = useState(false);
  const [isDisplayingMetadata, setIsDisplayingMetadata] = useState(false);

  const totalRows = selectedTable 
    ? tables.find(t => t.name === selectedTable)?.rowCount || 0 
    : 0;

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlCmd = event.ctrlKey || event.metaKey;
      
      // Ctrl/Cmd + B: Toggle sidebar (only when browsing tables)
      if (browseTables && isCtrlCmd && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
      
      // Press 'c': Open chart modal (when data is available and not editing text)
      // Explicitly exclude Ctrl/Cmd+C to prevent conflicts with copy
      if (event.key === 'c' && !event.ctrlKey && !event.metaKey && currentData && currentData.data.length > 0) {
        // Check if user is currently focused in a text editing context
        const activeElement = document.activeElement;
        const isEditingText = activeElement && (
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'INPUT' ||
          (activeElement as HTMLElement).contentEditable === 'true'
        );
        
        // Only trigger chart modal if user is not editing text
        if (!isEditingText) {
          event.preventDefault();
          setIsChartModalOpen(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, browseTables, currentData, setIsChartModalOpen]);

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
    setLastExecutedQuery(`0!meta ${tableName}`);
    await loadTableMetadata(tableName);
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

  const loadTableMetadata = async (tableName: string) => {
    setIsLoading(true);
    setIsDisplayingMetadata(true);
    try {
      const result = await executeQuery(`0!meta ${tableName}`);
      setCurrentData(result);
    } catch (error) {
      console.error('Error loading table metadata:', error);
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
    setIsDisplayingMetadata(false);
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

  // Load first table by default when connected and browsing tables
  useEffect(() => {
    if (connectionStatus === 'connected' && browseTables && tables.length > 0 && !selectedTable) {
      handleTableSelect(tables[0].name);
    }
  }, [tables, connectionStatus, browseTables]);

  // Handle browseTables toggle while connected
  useEffect(() => {
    const handleBrowseTablesChange = async () => {
      if (connectionStatus === 'connected') {
        if (browseTables && tables.length === 0) {
          // Fetch tables when enabling browsing while connected
          try {
            await refreshTables();
            setSelectedTable(null); // Clear any selected table
          } catch (error) {
            console.error('Failed to fetch tables:', error);
          }
        } else if (!browseTables) {
          // Clear table selection when disabling browsing
          setSelectedTable(null);
          setCurrentData(null);
        }
      }
    };

    handleBrowseTablesChange();
  }, [browseTables, connectionStatus, tables.length, refreshTables]);

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
      <header className="app-header px-2 py-0">
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
              browseTables={browseTables}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onCancelConnection={onCancelConnection}
              onBrowseTablesChange={setBrowseTables}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Query Executor and Main Content with Vertical Resizing */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical" className="h-full">
          {/* Query Executor Panel */}
          <Panel defaultSize={50} minSize={15} maxSize={85}>
            <QueryExecutorSimple
              onExecuteQuery={handleExecuteQuery}
              isExecuting={isExecuting}
              onCancelQuery={onCancelQuery}
            />
          </Panel>
          
          {/* Vertical Resize Handle */}
          <PanelResizeHandle className="h-1 bg-border hover:bg-primary/20 transition-colors cursor-row-resize" />
          
          {/* Main Content Panel */}
          <Panel defaultSize={50} minSize={15}>
            <div className="h-full overflow-hidden">
        {browseTables && isSidebarVisible ? (
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
                {/* Conditional rendering: Metadata Display or Virtual Data Grid */}
                {isDisplayingMetadata && selectedTable ? (
                  <TableMetadataDisplay
                    tableName={selectedTable}
                    data={currentData}
                    isLoading={isLoading}
                    onOpenChart={() => setIsChartModalOpen(true)}
                    hasData={!!(currentData && currentData.data.length > 0)}
                    enableColumnControls={true}
                    isSidebarVisible={browseTables && isSidebarVisible}
                    onShowSidebar={browseTables ? toggleSidebar : undefined}
                  />
                ) : (
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
                    isSidebarVisible={browseTables && isSidebarVisible}
                    onShowSidebar={browseTables ? toggleSidebar : undefined}
                  />
                )}
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          <div className="h-full flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
            {/* Conditional rendering: Metadata Display or Virtual Data Grid - Full Width */}
            {isDisplayingMetadata && selectedTable ? (
              <TableMetadataDisplay
                tableName={selectedTable}
                data={currentData}
                isLoading={isLoading}
                onOpenChart={() => setIsChartModalOpen(true)}
                hasData={!!(currentData && currentData.data.length > 0)}
                enableColumnControls={true}
                isSidebarVisible={browseTables && isSidebarVisible}
                onShowSidebar={browseTables ? toggleSidebar : undefined}
              />
            ) : (
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
                isSidebarVisible={browseTables && isSidebarVisible}
                onShowSidebar={browseTables ? toggleSidebar : undefined}
              />
            )}
            </div>
          )}
            </div>
          </Panel>
        </PanelGroup>
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