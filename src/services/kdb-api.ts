import { KdbQueryResult, KdbTable, ConnectionStatus } from '@/types/kdb';

const API_BASE_URL = 'http://localhost:3001/api';

export class KdbApiService {
  private connectionStatus: ConnectionStatus = 'disconnected';
  private eventListeners: Map<string, Function[]> = new Map();
  private abortController: AbortController | null = null;
  private queryAbortController: AbortController | null = null;

  constructor() {
    this.addEventListener = this.addEventListener.bind(this);
    this.removeEventListener = this.removeEventListener.bind(this);
    this.emit = this.emit.bind(this);
  }

  async connect(host: string, port: number): Promise<boolean> {
    try {
      // Cancel any existing connection attempt
      if (this.abortController) {
        this.abortController.abort();
      }

      // Create new AbortController for this connection attempt
      this.abortController = new AbortController();

      this.connectionStatus = 'connecting';
      this.emit('statusChange', this.connectionStatus);

      const response = await fetch(`${API_BASE_URL}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ host, port }),
        signal: this.abortController.signal,
      });

      const result = await response.json();

      if (result.success) {
        this.connectionStatus = 'connected';
        this.emit('statusChange', this.connectionStatus);
        this.abortController = null;
        return true;
      } else {
        this.connectionStatus = 'error';
        this.emit('statusChange', this.connectionStatus);
        this.emit('error', result.error || 'Connection failed');
        this.abortController = null;
        return false;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.connectionStatus = 'disconnected';
        this.emit('statusChange', this.connectionStatus);
        this.emit('error', 'Connection cancelled');
      } else {
        this.connectionStatus = 'error';
        this.emit('statusChange', this.connectionStatus);
        this.emit('error', `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      this.abortController = null;
      return false;
    }
  }

  disconnect(): void {
    this.connectionStatus = 'disconnected';
    this.emit('statusChange', this.connectionStatus);
  }

  cancelConnection(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  cancelQuery(): void {
    if (this.queryAbortController) {
      this.queryAbortController.abort();
      this.queryAbortController = null;
    }
  }

  async executeQuery(query: string): Promise<KdbQueryResult> {
    if (!this.isConnected()) {
      throw new Error('Not connected to KDB+ server');
    }

    try {
      // Cancel any existing query execution
      if (this.queryAbortController) {
        this.queryAbortController.abort();
      }

      // Create new AbortController for this query
      this.queryAbortController = new AbortController();

      const response = await fetch(`${API_BASE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: this.queryAbortController.signal,
      });

      const result = await response.json();

      if (result.success) {
        this.queryAbortController = null;
        return result.data;
      } else {
        this.queryAbortController = null;
        throw new Error(result.error || 'Query execution failed');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.queryAbortController = null;
        throw new Error('Query execution cancelled');
      }
      this.queryAbortController = null;
      throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTables(): Promise<KdbTable[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to KDB+ server');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tables`);
      const result = await response.json();

      if (result.success) {
        return result.tables;
      } else {
        throw new Error(result.error || 'Failed to fetch tables');
      }
    } catch (error) {
      throw new Error(`Failed to fetch tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTableData(tableName: string, offset: number = 0, limit: number = 100): Promise<KdbQueryResult> {
    if (!this.isConnected()) {
      throw new Error('Not connected to KDB+ server');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tables/${tableName}/data?offset=${offset}&limit=${limit}`);
      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to fetch table data');
      }
    } catch (error) {
      throw new Error(`Failed to fetch table data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTableMetadata(tableName: string): Promise<KdbQueryResult> {
    return this.executeQuery(`0!meta ${tableName}`);
  }

  isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  private addEventListener(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  private removeEventListener(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  // Public methods for event handling
  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.addEventListener('statusChange', listener);
    return () => this.removeEventListener('statusChange', listener);
  }

  onError(listener: (error: string) => void): () => void {
    this.addEventListener('error', listener);
    return () => this.removeEventListener('error', listener);
  }
}