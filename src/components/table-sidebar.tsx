import { useState } from 'react';
import { Table, Search, Database, Hash, PanelLeftClose } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { KdbTable } from '@/types/kdb';
import { formatNumber } from '@/lib/utils';

interface TableSidebarProps {
  tables: KdbTable[];
  selectedTable: string | null;
  onTableSelect: (tableName: string) => void;
  onToggleSidebar?: () => void;
}

export function TableSidebar({ tables, selectedTable, onTableSelect, onToggleSidebar }: TableSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    table.columns.some(col => col.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="app-sidebar flex flex-col h-full">
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Tables</h2>
            <span className="text-sm text-muted-foreground">({tables.length})</span>
          </div>
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="sidebar-toggle-btn p-1.5 text-muted-foreground hover:text-primary rounded"
              title={`Hide Tables Panel (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+B)`}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredTables.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchTerm ? 'No tables match your search' : 'No tables available'}
          </div>
        ) : (
          <div className="p-2">
            {filteredTables.map((table) => (
              <div
                key={table.name}
                className={`
                  sidebar-item p-3 rounded-lg cursor-pointer transition-colors mb-2
                  ${selectedTable === table.name
                    ? 'bg-primary/10 border border-primary/20'
                    : 'border border-transparent'
                  }
                `}
                onClick={() => onTableSelect(table.name)}
              >
                <div className="flex items-start space-x-3">
                  <Table className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate text-foreground mb-2">{table.name}</p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center">
                        <Hash className="h-3 w-3 mr-1" />
                        {table.columns.length} cols
                      </span>
                      <span className="whitespace-nowrap">
                        {formatNumber(table.rowCount)} rows
                      </span>
                    </div>
                  </div>
                </div>
                
                {selectedTable === table.name && table.columns.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Columns:</p>
                    <div className="flex flex-wrap gap-1">
                      {table.columns.slice(0, 8).map((column) => (
                        <span
                          key={column}
                          className="inline-block px-2 py-1 text-xs bg-muted text-muted-foreground rounded"
                        >
                          {column}
                        </span>
                      ))}
                      {table.columns.length > 8 && (
                        <span className="inline-block px-2 py-1 text-xs text-muted-foreground">
                          +{table.columns.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}