// File utilities for loading and saving KDB+ script files

export interface FileLoadResult {
  content: string;
  fileName: string;
  filePath?: string; // Note: File API doesn't provide full path for security reasons
}

export interface FileSaveOptions {
  content: string;
  fileName?: string;
  suggestedName?: string;
}

export interface FileSaveResult {
  success: boolean;
  fileName?: string;
  cancelled?: boolean;
  error?: string;
}

// Supported file extensions for KDB+ scripts
export const SUPPORTED_EXTENSIONS = ['.q', '.kdb', '.txt', '.sql'];

// Check if file has supported extension
export function isSupportedFile(fileName: string): boolean {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(extension);
}

// Extract file name without extension
export function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

// Get file extension
export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
}

// Load file content from File object
export function loadFileContent(file: File): Promise<FileLoadResult> {
  return new Promise((resolve, reject) => {
    if (!isSupportedFile(file.name)) {
      reject(new Error(`Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content !== null) {
        resolve({
          content,
          fileName: file.name,
          filePath: undefined // Browser security doesn't allow access to full path
        });
      } else {
        reject(new Error('Failed to read file content'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };
    
    reader.readAsText(file);
  });
}

// Load multiple files
export async function loadMultipleFiles(files: FileList): Promise<FileLoadResult[]> {
  const results: FileLoadResult[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < files.length; i++) {
    try {
      const result = await loadFileContent(files[i]);
      results.push(result);
    } catch (error) {
      errors.push(`${files[i].name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (errors.length > 0 && results.length === 0) {
    throw new Error(`Failed to load files:\n${errors.join('\n')}`);
  }
  
  if (errors.length > 0) {
    console.warn('Some files failed to load:', errors);
  }
  
  return results;
}

// Check if File System Access API is available
export function isFileSystemAccessSupported(): boolean {
  return 'showSaveFilePicker' in window;
}

// Save file using File System Access API (modern browsers)
async function saveFileWithFileSystemAccess(options: FileSaveOptions): Promise<FileSaveResult> {
  try {
    const { content, fileName, suggestedName } = options;
    const defaultName = fileName || suggestedName || 'query.q';
    
    // @ts-ignore - File System Access API types may not be available
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: defaultName,
      types: [
        {
          description: 'KDB+ Scripts',
          accept: {
            'text/plain': ['.q', '.kdb', '.txt']
          }
        }
      ]
    });
    
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    return {
      success: true,
      fileName: fileHandle.name
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        cancelled: true
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to save file'
    };
  }
}

// Save file using download fallback (older browsers)
function saveFileWithDownload(options: FileSaveOptions): FileSaveResult {
  try {
    const { content, fileName, suggestedName } = options;
    const defaultName = fileName || suggestedName || 'query.q';
    
    // Create a Blob with the content
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    
    // Create a download URL
    const url = URL.createObjectURL(blob);
    
    // Create a temporary download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = defaultName;
    
    // Append to document, click, and remove
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up the URL
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      fileName: defaultName
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to download file'
    };
  }
}

// Main save file function with progressive enhancement
export async function saveFileContent(options: FileSaveOptions): Promise<FileSaveResult> {
  if (isFileSystemAccessSupported()) {
    return await saveFileWithFileSystemAccess(options);
  } else {
    return saveFileWithDownload(options);
  }
}

// Legacy function for backward compatibility (will be removed)
export function saveFileContentLegacy(options: FileSaveOptions): void {
  saveFileWithDownload(options);
}

// Generate suggested file name based on content
export function generateSuggestedFileName(content: string, baseName?: string): string {
  if (baseName) {
    // If we have a base name, ensure it has a .q extension
    const extension = getFileExtension(baseName);
    if (!extension) {
      return `${baseName}.q`;
    }
    return baseName;
  }
  
  // Extract potential table/function names from content for naming
  const lines = content.split('\n').filter(line => line.trim());
  
  // Look for table definitions or function definitions
  for (const line of lines.slice(0, 10)) { // Check first 10 lines
    const trimmed = line.trim();
    
    // Look for table assignments like: trades:...
    const tableMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (tableMatch) {
      return `${tableMatch[1]}.q`;
    }
    
    // Look for function definitions like: myFunc:{...}
    const funcMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{/);
    if (funcMatch) {
      return `${funcMatch[1]}.q`;
    }
    
    // Look for select statements: select from tableName
    const selectMatch = trimmed.match(/select.*from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (selectMatch) {
      return `${selectMatch[1]}_query.q`;
    }
  }
  
  // Default name with timestamp
  const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
  return `query_${timestamp}.q`;
}

// Create file input element for file selection
export function createFileInputElement(options: {
  multiple?: boolean;
  accept?: string;
  onChange?: (files: FileList) => void;
}): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = options.multiple || false;
  input.accept = options.accept || SUPPORTED_EXTENSIONS.join(',');
  input.style.display = 'none';
  
  if (options.onChange) {
    input.addEventListener('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        options.onChange!(files);
      }
    });
  }
  
  return input;
}

// Handle drag and drop files
export function handleFileDrop(event: DragEvent): File[] {
  event.preventDefault();
  event.stopPropagation();
  
  const files: File[] = [];
  
  if (event.dataTransfer?.files) {
    for (let i = 0; i < event.dataTransfer.files.length; i++) {
      const file = event.dataTransfer.files[i];
      if (isSupportedFile(file.name)) {
        files.push(file);
      }
    }
  }
  
  return files;
}

// Prevent default drag behavior
export function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

// Recent files management (in-memory only for security)
const RECENT_FILES_KEY = 'kdb-viz-recent-files';
const MAX_RECENT_FILES = 10;

export interface RecentFile {
  fileName: string;
  timestamp: number;
}

export function addRecentFile(fileName: string): void {
  try {
    const recent = getRecentFiles();
    
    // Remove if already exists
    const filtered = recent.filter(f => f.fileName !== fileName);
    
    // Add to beginning
    filtered.unshift({ fileName, timestamp: Date.now() });
    
    // Limit size
    const limited = filtered.slice(0, MAX_RECENT_FILES);
    
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(limited));
  } catch (error) {
    console.warn('Failed to save recent files:', error);
  }
}

export function getRecentFiles(): RecentFile[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    if (!stored) return [];
    
    const recent: RecentFile[] = JSON.parse(stored);
    return recent.filter(f => f.fileName && f.timestamp);
  } catch (error) {
    console.warn('Failed to load recent files:', error);
    return [];
  }
}

export function clearRecentFiles(): void {
  try {
    localStorage.removeItem(RECENT_FILES_KEY);
  } catch (error) {
    console.warn('Failed to clear recent files:', error);
  }
}