import { Info } from 'lucide-react';
import { VirtualDataGrid } from './virtual-data-grid';
import { KdbQueryResult } from '@/types/kdb';

interface TableMetadataDisplayProps {
  tableName: string;
  data: KdbQueryResult | null;
  isLoading: boolean;
  onOpenChart?: () => void;
  hasData: boolean;
  enableColumnControls?: boolean;
  isSidebarVisible?: boolean;
  onShowSidebar?: () => void;
}

export function TableMetadataDisplay({
  tableName,
  data,
  isLoading,
  onOpenChart,
  hasData,
  enableColumnControls = true,
  isSidebarVisible,
  onShowSidebar,
}: TableMetadataDisplayProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Metadata Header */}
      <div className="bg-muted/50 border-b border-border px-4 py-3">
        <div className="flex items-center space-x-2">
          <Info className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            Table Schema: <span className="font-mono text-primary">{tableName}</span>
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Column metadata showing types, foreign keys, and attributes
        </p>
      </div>

      {/* Metadata Grid */}
      <div className="flex-1 overflow-hidden">
        <VirtualDataGrid
          data={data}
          isLoading={isLoading}
          onOpenChart={onOpenChart}
          hasData={hasData}
          enableColumnControls={enableColumnControls}
          isSidebarVisible={isSidebarVisible}
          onShowSidebar={onShowSidebar}
          clientSidePagination={true}
        />
      </div>
    </div>
  );
}