// Query Storage Utility for KDB+ Visualizer
// Provides persistent storage and management for saved queries

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description?: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  executionCount: number;
  lastExecutedAt?: Date;
}

export interface QueryCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface QueryStorage {
  queries: SavedQuery[];
  categories: QueryCategory[];
  recentQueries: string[];
  settings: {
    maxRecentQueries: number;
    autoBackup: boolean;
    lastBackupAt?: Date;
  };
}

const STORAGE_KEY = 'kdb-viz-queries';
const DEFAULT_STORAGE: QueryStorage = {
  queries: [],
  categories: [
    { id: 'general', name: 'General', description: 'General queries' },
    { id: 'analysis', name: 'Analysis', description: 'Data analysis queries' },
    { id: 'monitoring', name: 'Monitoring', description: 'System monitoring queries' }
  ],
  recentQueries: [],
  settings: {
    maxRecentQueries: 10,
    autoBackup: true
  }
};

// Generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get storage data from localStorage
function getStorageData(): QueryStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STORAGE;
    
    const parsed = JSON.parse(stored);
    // Convert date strings back to Date objects
    parsed.queries = parsed.queries.map((q: any) => ({
      ...q,
      createdAt: new Date(q.createdAt),
      updatedAt: new Date(q.updatedAt),
      lastExecutedAt: q.lastExecutedAt ? new Date(q.lastExecutedAt) : undefined
    }));
    
    // Ensure all required fields exist
    return {
      ...DEFAULT_STORAGE,
      ...parsed,
      settings: { ...DEFAULT_STORAGE.settings, ...parsed.settings }
    };
  } catch (error) {
    console.error('Error loading query storage:', error);
    return DEFAULT_STORAGE;
  }
}

// Save storage data to localStorage
function saveStorageData(data: QueryStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving query storage:', error);
    throw new Error('Failed to save queries. Storage may be full.');
  }
}

// Query Management Functions

export function saveQuery(
  name: string, 
  query: string, 
  options: {
    description?: string;
    category?: string;
    tags?: string[];
    id?: string; // For updates
  } = {}
): SavedQuery {
  const storage = getStorageData();
  const now = new Date();
  
  let savedQuery: SavedQuery;
  
  if (options.id) {
    // Update existing query
    const existingIndex = storage.queries.findIndex(q => q.id === options.id);
    if (existingIndex === -1) {
      throw new Error('Query not found for update');
    }
    
    savedQuery = {
      ...storage.queries[existingIndex],
      name,
      query,
      description: options.description,
      category: options.category,
      tags: options.tags || [],
      updatedAt: now
    };
    
    storage.queries[existingIndex] = savedQuery;
  } else {
    // Create new query
    savedQuery = {
      id: generateId(),
      name,
      query,
      description: options.description,
      category: options.category || 'general',
      tags: options.tags || [],
      createdAt: now,
      updatedAt: now,
      executionCount: 0
    };
    
    storage.queries.push(savedQuery);
  }
  
  saveStorageData(storage);
  return savedQuery;
}

export function getSavedQueries(options: {
  category?: string;
  search?: string;
  tags?: string[];
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'executionCount';
  sortOrder?: 'asc' | 'desc';
} = {}): SavedQuery[] {
  const storage = getStorageData();
  let queries = [...storage.queries];
  
  // Filter by category
  if (options.category) {
    queries = queries.filter(q => q.category === options.category);
  }
  
  // Filter by search term
  if (options.search) {
    const searchTerm = options.search.toLowerCase();
    queries = queries.filter(q => 
      q.name.toLowerCase().includes(searchTerm) ||
      q.query.toLowerCase().includes(searchTerm) ||
      q.description?.toLowerCase().includes(searchTerm)
    );
  }
  
  // Filter by tags
  if (options.tags && options.tags.length > 0) {
    queries = queries.filter(q => 
      options.tags!.some(tag => q.tags?.includes(tag))
    );
  }
  
  // Sort queries
  const sortBy = options.sortBy || 'updatedAt';
  const sortOrder = options.sortOrder || 'desc';
  
  queries.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'createdAt':
        aVal = a.createdAt.getTime();
        bVal = b.createdAt.getTime();
        break;
      case 'updatedAt':
        aVal = a.updatedAt.getTime();
        bVal = b.updatedAt.getTime();
        break;
      case 'executionCount':
        aVal = a.executionCount;
        bVal = b.executionCount;
        break;
      default:
        aVal = a.updatedAt.getTime();
        bVal = b.updatedAt.getTime();
    }
    
    if (sortOrder === 'desc') {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    } else {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    }
  });
  
  return queries;
}

export function deleteQuery(id: string): boolean {
  const storage = getStorageData();
  const index = storage.queries.findIndex(q => q.id === id);
  
  if (index === -1) return false;
  
  storage.queries.splice(index, 1);
  saveStorageData(storage);
  return true;
}

export function getQueryById(id: string): SavedQuery | null {
  const storage = getStorageData();
  return storage.queries.find(q => q.id === id) || null;
}

export function recordQueryExecution(id: string): void {
  const storage = getStorageData();
  const query = storage.queries.find(q => q.id === id);
  
  if (query) {
    query.executionCount += 1;
    query.lastExecutedAt = new Date();
    saveStorageData(storage);
  }
}

// Recent Queries Management

export function addToRecentQueries(query: string): void {
  const storage = getStorageData();
  
  // Remove if already exists
  const existingIndex = storage.recentQueries.indexOf(query);
  if (existingIndex !== -1) {
    storage.recentQueries.splice(existingIndex, 1);
  }
  
  // Add to beginning
  storage.recentQueries.unshift(query);
  
  // Limit size
  if (storage.recentQueries.length > storage.settings.maxRecentQueries) {
    storage.recentQueries = storage.recentQueries.slice(0, storage.settings.maxRecentQueries);
  }
  
  saveStorageData(storage);
}

export function getRecentQueries(): string[] {
  const storage = getStorageData();
  return [...storage.recentQueries];
}

export function clearRecentQueries(): void {
  const storage = getStorageData();
  storage.recentQueries = [];
  saveStorageData(storage);
}

// Category Management

export function getCategories(): QueryCategory[] {
  const storage = getStorageData();
  return [...storage.categories];
}

export function addCategory(name: string, description?: string, color?: string): QueryCategory {
  const storage = getStorageData();
  
  const category: QueryCategory = {
    id: generateId(),
    name,
    description,
    color
  };
  
  storage.categories.push(category);
  saveStorageData(storage);
  return category;
}

export function updateCategory(id: string, updates: Partial<Omit<QueryCategory, 'id'>>): boolean {
  const storage = getStorageData();
  const category = storage.categories.find(c => c.id === id);
  
  if (!category) return false;
  
  Object.assign(category, updates);
  saveStorageData(storage);
  return true;
}

export function deleteCategory(id: string): boolean {
  const storage = getStorageData();
  const index = storage.categories.findIndex(c => c.id === id);
  
  if (index === -1) return false;
  
  // Move queries in this category to 'general'
  storage.queries.forEach(query => {
    if (query.category === id) {
      query.category = 'general';
    }
  });
  
  storage.categories.splice(index, 1);
  saveStorageData(storage);
  return true;
}

// Import/Export Functions

export function exportQueries(options: {
  includeCategories?: boolean;
  includeSettings?: boolean;
  queryIds?: string[];
} = {}): string {
  const storage = getStorageData();
  
  let exportData: Partial<QueryStorage> = {
    queries: options.queryIds 
      ? storage.queries.filter(q => options.queryIds!.includes(q.id))
      : storage.queries
  };
  
  if (options.includeCategories) {
    exportData.categories = storage.categories;
  }
  
  if (options.includeSettings) {
    exportData.settings = storage.settings;
  }
  
  return JSON.stringify(exportData, null, 2);
}

export function importQueries(
  jsonData: string, 
  options: {
    overwrite?: boolean;
    mergeCategories?: boolean;
  } = {}
): { imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;
  
  try {
    const importData = JSON.parse(jsonData);
    const storage = getStorageData();
    
    // Import categories
    if (importData.categories && options.mergeCategories) {
      importData.categories.forEach((cat: QueryCategory) => {
        const existing = storage.categories.find(c => c.name === cat.name);
        if (!existing) {
          storage.categories.push({
            ...cat,
            id: generateId() // Generate new ID to avoid conflicts
          });
        }
      });
    }
    
    // Import queries
    if (importData.queries) {
      importData.queries.forEach((query: any) => {
        try {
          const existingQuery = storage.queries.find(q => q.name === query.name);
          
          if (existingQuery && !options.overwrite) {
            errors.push(`Query "${query.name}" already exists`);
            return;
          }
          
          const savedQuery: SavedQuery = {
            id: generateId(),
            name: query.name,
            query: query.query,
            description: query.description,
            category: query.category || 'general',
            tags: query.tags || [],
            createdAt: new Date(query.createdAt || Date.now()),
            updatedAt: new Date(query.updatedAt || Date.now()),
            executionCount: query.executionCount || 0,
            lastExecutedAt: query.lastExecutedAt ? new Date(query.lastExecutedAt) : undefined
          };
          
          if (existingQuery) {
            const index = storage.queries.indexOf(existingQuery);
            storage.queries[index] = savedQuery;
          } else {
            storage.queries.push(savedQuery);
          }
          
          imported++;
        } catch (error) {
          errors.push(`Failed to import query "${query.name}": ${error}`);
        }
      });
    }
    
    saveStorageData(storage);
  } catch (error) {
    errors.push(`Invalid JSON format: ${error}`);
  }
  
  return { imported, errors };
}

// Backup and Storage Management

export function createBackup(): string {
  const storage = getStorageData();
  const backup = {
    ...storage,
    backupDate: new Date().toISOString(),
    version: '1.0'
  };
  
  return JSON.stringify(backup, null, 2);
}

export function restoreFromBackup(backupData: string): { success: boolean; error?: string } {
  try {
    const backup = JSON.parse(backupData);
    
    // Validate backup format
    if (!backup.queries || !Array.isArray(backup.queries)) {
      return { success: false, error: 'Invalid backup format' };
    }
    
    // Restore data
    const restoredStorage: QueryStorage = {
      queries: backup.queries.map((q: any) => ({
        ...q,
        createdAt: new Date(q.createdAt),
        updatedAt: new Date(q.updatedAt),
        lastExecutedAt: q.lastExecutedAt ? new Date(q.lastExecutedAt) : undefined
      })),
      categories: backup.categories || DEFAULT_STORAGE.categories,
      recentQueries: backup.recentQueries || [],
      settings: { ...DEFAULT_STORAGE.settings, ...backup.settings }
    };
    
    saveStorageData(restoredStorage);
    return { success: true };
  } catch (error) {
    return { success: false, error: `Failed to restore backup: ${error}` };
  }
}

export function getStorageStats(): {
  totalQueries: number;
  totalCategories: number;
  recentQueriesCount: number;
  storageSize: number;
  oldestQuery?: Date;
  newestQuery?: Date;
} {
  const storage = getStorageData();
  const storageString = JSON.stringify(storage);
  const storageSize = new Blob([storageString]).size;
  
  const queryDates = storage.queries.map(q => q.createdAt);
  const oldestQuery = queryDates.length > 0 ? new Date(Math.min(...queryDates.map(d => d.getTime()))) : undefined;
  const newestQuery = queryDates.length > 0 ? new Date(Math.max(...queryDates.map(d => d.getTime()))) : undefined;
  
  return {
    totalQueries: storage.queries.length,
    totalCategories: storage.categories.length,
    recentQueriesCount: storage.recentQueries.length,
    storageSize,
    oldestQuery,
    newestQuery
  };
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
}