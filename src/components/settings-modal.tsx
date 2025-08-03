import { X, BarChart3, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartDataSource: 'full' | 'displayed';
  onChartDataSourceChange: (value: 'full' | 'displayed') => void;
  fullDataRowCount?: number;
  displayedDataRowCount?: number;
}

export function SettingsModal({
  isOpen,
  onClose,
  chartDataSource,
  onChartDataSourceChange,
  fullDataRowCount = 0,
  displayedDataRowCount = 0,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-[500px] max-h-[80vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Chart Configuration Section */}
          <div>
            <h3 className="text-md font-medium text-foreground mb-3 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Chart Configuration
            </h3>
            
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-3">
                Choose which data to use when creating charts:
              </div>
              
              {/* Full Dataset Option */}
              <label className="flex items-start space-x-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="chartDataSource"
                  value="full"
                  checked={chartDataSource === 'full'}
                  onChange={(e) => onChartDataSourceChange(e.target.value as 'full' | 'displayed')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Use Full Dataset</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Charts will include all data from the query result
                    {fullDataRowCount > 0 && (
                      <span className="text-primary font-medium"> ({fullDataRowCount.toLocaleString()} rows)</span>
                    )}
                  </div>
                </div>
              </label>

              {/* Displayed Rows Option */}
              <label className="flex items-start space-x-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="chartDataSource"
                  value="displayed"
                  checked={chartDataSource === 'displayed'}
                  onChange={(e) => onChartDataSourceChange(e.target.value as 'full' | 'displayed')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Use Displayed Rows Only</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Charts will only include rows currently visible in the data grid
                    {displayedDataRowCount > 0 && (
                      <span className="text-primary font-medium"> ({displayedDataRowCount.toLocaleString()} rows)</span>
                    )}
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}