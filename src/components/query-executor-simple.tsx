import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Code, FolderOpen, Plus, X, FileText, Download } from 'lucide-react';
import { KdbQueryResult } from '@/types/kdb';
import { 
  loadMultipleFiles, 
  saveFileContent, 
  generateSuggestedFileName,
  addRecentFile,
  handleFileDrop,
  handleDragOver,
  isFileSystemAccessSupported
} from '@/lib/file-utils';

interface QueryExecutorSimpleProps {
  onExecuteQuery: (query: string) => Promise<KdbQueryResult>;
  isExecuting: boolean;
}

interface QueryTab {
  id: string;
  name: string;
  query: string;
  isModified: boolean;
  filePath?: string;
  fileName?: string;
  createdAt: Date;
}

// Query parsing types and interfaces
interface ParsedQuery {
  query: string;
  start: number;
  end: number;
  index: number;
}

// Core query parsing functions
const parseQueries = (text: string): ParsedQuery[] => {
  if (!text.trim()) return [];
  
  // Check if text contains semicolons
  if (!text.includes(';')) {
    // Single query mode - treat entire content as one query
    return [{
      query: text.trim(),
      start: 0,
      end: text.length,
      index: 0
    }];
  }
  
  // Multi-query mode - split by semicolons
  const parts = text.split(';');
  const queries: ParsedQuery[] = [];
  let currentPos = 0;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const queryText = part.trim();
    
    if (queryText) {
      // Find the actual start position of the trimmed query
      const untrimmedStart = currentPos;
      const trimmedStart = untrimmedStart + part.indexOf(part.trim());
      
      queries.push({
        query: queryText,
        start: trimmedStart,
        end: trimmedStart + queryText.length,
        index: i
      });
    }
    
    currentPos += part.length + 1; // +1 for semicolon
  }
  
  return queries;
};

const getCurrentQueryAtCursor = (text: string, cursorPos: number): string => {
  const queries = parseQueries(text);
  
  if (queries.length === 0) return '';
  if (queries.length === 1) return queries[0].query;
  
  // Find query containing cursor position
  for (const q of queries) {
    if (cursorPos >= q.start && cursorPos <= q.end) {
      return q.query;
    }
  }
  
  // If cursor is between queries, find the closest one
  let closestQuery = queries[0];
  let minDistance = Math.abs(cursorPos - queries[0].start);
  
  for (const q of queries) {
    const distanceToStart = Math.abs(cursorPos - q.start);
    const distanceToEnd = Math.abs(cursorPos - q.end);
    const distance = Math.min(distanceToStart, distanceToEnd);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestQuery = q;
    }
  }
  
  return closestQuery.query;
};

const getSelectedOrCurrentQuery = (
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  fullText: string
): string => {
  const textarea = textareaRef.current;
  if (!textarea) return fullText.trim();
  
  const { selectionStart, selectionEnd } = textarea;
  
  // If text is selected, execute selection
  if (selectionStart !== selectionEnd) {
    return fullText.substring(selectionStart, selectionEnd).trim();
  }
  
  // Otherwise, execute current query at cursor
  return getCurrentQueryAtCursor(fullText, selectionStart);
};

export function QueryExecutorSimple({ onExecuteQuery, isExecuting }: QueryExecutorSimpleProps) {
  // Helper to generate unique IDs
  const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create initial tab outside of state to ensure consistency
  const initialTab = useMemo<QueryTab>(() => ({
    id: generateTabId(),
    name: 'Query 1',
    query: '',
    isModified: false,
    createdAt: new Date()
  }), []);

  // Tab management state with initial tab
  const [tabs, setTabs] = useState<QueryTab[]>([initialTab]);
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id);
  const [error, setError] = useState<string | null>(null);
  const [currentQueryInfo, setCurrentQueryInfo] = useState<{index: number, total: number, selectedText?: string} | null>(null);
  
  // File operation state
  
  // Textarea reference for selection handling
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Hidden file input for file operations
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get active tab
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const query = activeTab?.query || '';


  // Tab management functions
  const createNewTab = (name?: string, content?: string, filePath?: string, fileName?: string) => {
    const newTab: QueryTab = {
      id: generateTabId(),
      name: name || fileName || `Query ${tabs.length + 1}`,
      query: content || '',
      isModified: false,
      filePath,
      fileName,
      createdAt: new Date()
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return newTab;
  };

  const closeTab = (tabId: string) => {
    const tabToClose = tabs.find(tab => tab.id === tabId);
    if (!tabToClose) return;
    
    // Check if tab has unsaved changes
    if (tabToClose.isModified) {
      const shouldClose = window.confirm(`Tab "${tabToClose.name}" has unsaved changes. Close anyway?`);
      if (!shouldClose) return;
    }
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    // Switch to another tab if the closed tab was active
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        const tabIndex = tabs.findIndex(tab => tab.id === tabId);
        const nextTab = newTabs[Math.max(0, tabIndex - 1)];
        setActiveTabId(nextTab.id);
      } else {
        // Create a new tab if no tabs remain
        createNewTab();
      }
    }
  };

  const switchToTab = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const updateTabQuery = (tabId: string, newQuery: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, query: newQuery, isModified: true }
        : tab
    ));
  };


  const markTabAsSaved = (tabId: string, filePath?: string, fileName?: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, isModified: false, filePath, fileName, name: fileName || tab.name }
        : tab
    ));
  };

  // Enhanced execution function for smart query selection
  const executeQuery = async (queryToExecute: string) => {
    if (!queryToExecute || isExecuting) return;

    try {
      setError(null);
      await onExecuteQuery(queryToExecute);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
    }
  };

  // Execute selected text or current query at cursor
  const handleExecuteSelected = async () => {
    if (!query.trim() || isExecuting) return;
    
    const queryToExecute = getSelectedOrCurrentQuery(textareaRef, query);
    
    // Enhanced error handling for edge cases
    if (!queryToExecute.trim()) {
      setError('No query to execute. Please ensure you have selected text or your cursor is within a query.');
      return;
    }
    
    // Check if the query is just whitespace or comments
    if (queryToExecute.trim().length === 0 || queryToExecute.trim().startsWith('//')) {
      setError('Selected text appears to be empty or a comment. Please select a valid query.');
      return;
    }
    
    await executeQuery(queryToExecute);
  };

  // Legacy function for backward compatibility (Ctrl+Enter)
  const handleExecute = async () => {
    await handleExecuteSelected();
  };

  // File operations
  const handleLoadFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const results = await loadMultipleFiles(files);
      
      for (const result of results) {
        // Check if file is already open
        const existingTab = tabs.find(tab => tab.fileName === result.fileName);
        if (existingTab) {
          // Switch to existing tab
          switchToTab(existingTab.id);
        } else {
          // Create new tab for file
          createNewTab(undefined, result.content, result.filePath, result.fileName);
        }
        
        // Add to recent files
        addRecentFile(result.fileName);
      }
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load file(s)');
    }
    
    // Reset file input
    event.target.value = '';
  };

  const handleSaveAsFile = async () => {
    if (!activeTab || !activeTab.query.trim()) {
      setError('Cannot save empty query');
      return;
    }

    try {
      const suggestedName = generateSuggestedFileName(
        activeTab.query, 
        activeTab.fileName || activeTab.name
      );
      
      const result = await saveFileContent({
        content: activeTab.query,
        suggestedName
      });
      
      if (result.success) {
        // Mark tab as saved
        markTabAsSaved(activeTab.id, undefined, result.fileName);
        addRecentFile(result.fileName || suggestedName);
        setError(null);
        
        // Show success message for File System Access API
        if (isFileSystemAccessSupported()) {
          console.log(`File saved successfully: ${result.fileName}`);
        }
      } else if (result.cancelled) {
        // User cancelled the save dialog
        setError(null); // Don't show error for user cancellation
      } else {
        setError(result.error || 'Failed to save file');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save file');
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isCtrlCmd = e.ctrlKey || e.metaKey;
    
    if (isCtrlCmd && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (isCtrlCmd && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      handleExecuteSelected();
    } else if (isCtrlCmd && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSaveAsFile();
    } else if (isCtrlCmd && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      handleLoadFile();
    } else if (isCtrlCmd && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      createNewTab();
    } else if (isCtrlCmd && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (activeTab) {
        closeTab(activeTab.id);
      }
    }
  };

  // Handle query content changes
  const handleQueryChange = (newQuery: string) => {
    if (activeTab) {
      updateTabQuery(activeTab.id, newQuery);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOverEvent = (e: React.DragEvent) => {
    handleDragOver(e.nativeEvent);
  };

  const handleDropEvent = async (e: React.DragEvent) => {
    try {
      const files = handleFileDrop(e.nativeEvent);
      if (files.length === 0) {
        setError('No supported files found. Supported: .q, .kdb, .txt');
        return;
      }

      const results = await loadMultipleFiles(files as any as FileList);
      
      for (const result of results) {
        // Check if file is already open
        const existingTab = tabs.find(tab => tab.fileName === result.fileName);
        if (existingTab) {
          switchToTab(existingTab.id);
        } else {
          createNewTab(undefined, result.content, result.filePath, result.fileName);
        }
        addRecentFile(result.fileName);
      }
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load dropped files');
    }
  };

  // Update current query info when cursor moves or text changes
  const updateCurrentQueryInfo = () => {
    if (!textareaRef.current || !query.trim()) {
      setCurrentQueryInfo(null);
      return;
    }

    const queries = parseQueries(query);
    if (queries.length <= 1) {
      setCurrentQueryInfo(null);
      return;
    }

    const { selectionStart, selectionEnd } = textareaRef.current;
    
    // If there's a selection, show that info instead
    if (selectionStart !== selectionEnd) {
      const selectedText = query.substring(selectionStart, selectionEnd).trim();
      if (selectedText) {
        setCurrentQueryInfo({
          index: 0, // Special case for selection
          total: queries.length,
          selectedText: selectedText.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText
        });
        return;
      }
    }

    // Otherwise show current query at cursor
    let currentIndex = 0;
    for (let i = 0; i < queries.length; i++) {
      if (selectionStart >= queries[i].start && selectionStart <= queries[i].end) {
        currentIndex = i;
        break;
      }
    }

    setCurrentQueryInfo({
      index: currentIndex + 1, // 1-based for display
      total: queries.length
    });
  };

  // Handle cursor movement and selection changes
  const handleCursorChange = () => {
    updateCurrentQueryInfo();
  };


  return (
    <div className="bg-card border-b border-border p-2">
      {/* Tab Headers */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Code className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Query Executor</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadFile}
            title="Load File (Ctrl/Cmd + O)"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Load
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAsFile}
            disabled={!activeTab || !activeTab.query.trim()}
            title={isFileSystemAccessSupported() 
              ? "Save As - Choose location (Ctrl/Cmd + S)" 
              : "Save As - Download file (Ctrl/Cmd + S)"}
          >
            <Download className="h-4 w-4 mr-2" />
            Save As
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 mb-2">
        <div className="flex items-center space-x-1 flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-sm cursor-pointer group relative min-w-0 ${
                tab.id === activeTabId
                  ? 'bg-background border border-border'
                  : 'hover:bg-accent'
              }`}
              onClick={() => switchToTab(tab.id)}
            >
              <FileText className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-24" title={tab.name}>
                {tab.name}
              </span>
              {tab.isModified && (
                <span className="text-primary">•</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => createNewTab()}
          title="New Tab (Ctrl/Cmd + N)"
          className="flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".q,.kdb,.txt"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <div className="space-y-2">
        <div>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => {
              handleQueryChange(e.target.value);
              setTimeout(updateCurrentQueryInfo, 0); // Update after state change
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={handleCursorChange}
            onClick={handleCursorChange}
            onSelect={handleCursorChange}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOverEvent}
            onDrop={handleDropEvent}
            placeholder="Enter your q query here... (Ctrl/Cmd + O to load file, Ctrl/Cmd + S to save, drag & drop .q files)"
            className="w-full min-h-20 max-h-[80vh] px-3 py-2 border border-border rounded-md overflow-x-auto whitespace-pre focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm bg-background text-foreground transition-colors"
            disabled={isExecuting || !activeTab}
            style={{ resize: 'both' }}
          />
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}


        {currentQueryInfo && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              {currentQueryInfo.selectedText ? (
                <span className="text-primary font-medium">
                  Will execute: "{currentQueryInfo.selectedText}"
                </span>
              ) : (
                <span className="text-primary font-medium">
                  Query {currentQueryInfo.index} of {currentQueryInfo.total}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}