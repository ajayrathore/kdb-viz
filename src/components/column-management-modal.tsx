import React from 'react';
import { X, EyeOff, RotateCcw, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ColumnManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnOrder: string[];
  table: any;
  data: any;
  dropdownDraggedColumn: string | null;
  handleDropdownDragStart: (e: React.DragEvent, columnId: string) => void;
  handleDropdownDragOver: (e: React.DragEvent) => void;
  handleDropdownDrop: (e: React.DragEvent, targetColumnId: string) => void;
  handleDropdownDragEnd: (e: React.DragEvent) => void;
  resetColumnOrder: () => void;
}

export function ColumnManagementModal({
  isOpen,
  onClose,
  columnOrder,
  table,
  data,
  dropdownDraggedColumn,
  handleDropdownDragStart,
  handleDropdownDragOver,
  handleDropdownDrop,
  handleDropdownDragEnd,
  resetColumnOrder,
}: ColumnManagementModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg w-96 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Column Management</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Column List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 min-h-0">
          {columnOrder.map((columnId) => {
            const column = table.getColumn(columnId);
            if (!column || !column.getCanHide()) return null;
            
            const columnIndex = parseInt(columnId);
            const columnName = data?.columns[columnIndex] || `Column ${columnIndex + 1}`;
            const isDragging = dropdownDraggedColumn === columnId;
            
            return (
              <div
                key={columnId}
                className={`dropdown-drag-item flex items-center px-2 py-2 text-sm cursor-pointer select-none hover:bg-accent/50 rounded ${
                  isDragging ? 'dragging opacity-50' : ''
                }`}
                draggable
                onDragStart={(e) => handleDropdownDragStart(e, columnId)}
                onDragOver={handleDropdownDragOver}
                onDrop={(e) => handleDropdownDrop(e, columnId)}
                onDragEnd={handleDropdownDragEnd}
              >
                <GripVertical className="dropdown-drag-handle h-4 w-4 text-muted-foreground mr-3 flex-shrink-0" />
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={(e) => column.toggleVisibility(e.target.checked)}
                    className="h-4 w-4 rounded border border-input bg-background ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                  <span className="capitalize truncate font-medium">{columnName}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border p-4 space-y-2">
          <Button
            variant="outline"
            onClick={() => table.resetColumnVisibility()}
            className="w-full justify-start"
          >
            <EyeOff className="mr-2 h-4 w-4" />
            Reset Visibility
          </Button>
          <Button
            variant="outline"
            onClick={resetColumnOrder}
            className="w-full justify-start"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Column Order
          </Button>
        </div>
      </div>
    </div>
  );
}