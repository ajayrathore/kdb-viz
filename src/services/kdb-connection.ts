import { KdbQueryResult, KdbTable, ConnectionStatus } from '@/types/kdb';

export class KdbConnectionService {
  private ws: WebSocket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private callbacks: Map<string, (data: any) => void> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.addEventListener = this.addEventListener.bind(this);
    this.removeEventListener = this.removeEventListener.bind(this);
    this.emit = this.emit.bind(this);
  }

  async connect(host: string, port: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.connectionStatus = 'connecting';
        this.emit('statusChange', this.connectionStatus);

        // For KDB+, we typically use HTTP or TCP connections
        // Since WebSocket isn't standard for KDB+, we'll simulate the connection
        // In a real implementation, you'd use a KDB+ JavaScript client library
        
        // Simulate connection delay
        setTimeout(() => {
          // Create a mock WebSocket-like connection
          this.ws = new WebSocket(`ws://${host}:${port + 1000}`); // Mock WebSocket port
          
          this.ws.onopen = () => {
            this.connectionStatus = 'connected';
            this.emit('statusChange', this.connectionStatus);
            resolve(true);
          };

          this.ws.onerror = (error) => {
            this.connectionStatus = 'error';
            this.emit('statusChange', this.connectionStatus);
            this.emit('error', `Connection failed: ${error}`);
            reject(new Error('Connection failed'));
          };

          this.ws.onclose = () => {
            this.connectionStatus = 'disconnected';
            this.emit('statusChange', this.connectionStatus);
          };

          this.ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.id && this.callbacks.has(data.id)) {
                const callback = this.callbacks.get(data.id)!;
                callback(data.result);
                this.callbacks.delete(data.id);
              }
            } catch (e) {
              console.error('Failed to parse message:', e);
            }
          };
        }, 1000);

      } catch (error) {
        this.connectionStatus = 'error';
        this.emit('statusChange', this.connectionStatus);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus = 'disconnected';
    this.emit('statusChange', this.connectionStatus);
  }

  async executeQuery(query: string): Promise<KdbQueryResult> {
    if (!this.isConnected()) {
      throw new Error('Not connected to KDB+ server');
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      
      this.callbacks.set(id, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      });

      // Send query to KDB+ server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ id, query }));
      } else {
        // For development, return mock data
        setTimeout(() => {
          const mockResult = this.generateMockQueryResult(query);
          resolve(mockResult);
        }, 500);
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error('Query timeout'));
        }
      }, 30000);
    });
  }

  async getTables(): Promise<KdbTable[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to KDB+ server');
    }

    // Mock tables for development
    return [
      { name: 'trades', columns: ['sym', 'time', 'price', 'size'], rowCount: 100000 },
      { name: 'quotes', columns: ['sym', 'time', 'bid', 'ask', 'bsize', 'asize'], rowCount: 250000 },
      { name: 'orders', columns: ['id', 'sym', 'side', 'qty', 'price', 'status'], rowCount: 50000 },
      { name: 'positions', columns: ['account', 'sym', 'qty', 'avgPrice'], rowCount: 1500 },
    ];
  }

  async getTableData(tableName: string, offset: number = 0, limit: number = 100): Promise<KdbQueryResult> {
    const query = `select from ${tableName} limit ${limit} offset ${offset}`;
    return this.executeQuery(query);
  }

  isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  private generateMockQueryResult(query: string): KdbQueryResult {
    // Generate mock data based on query
    const isTradesQuery = query.includes('trades') || query.includes('trade');
    const isQuotesQuery = query.includes('quotes') || query.includes('quote');
    
    if (isTradesQuery) {
      return {
        columns: ['sym', 'time', 'price', 'size'],
        data: Array.from({ length: 50 }, (_, i) => [
          ['AAPL', 'GOOGL', 'MSFT', 'TSLA'][i % 4],
          new Date(Date.now() - Math.random() * 86400000).toISOString(),
          Math.random() * 200 + 100,
          Math.floor(Math.random() * 1000) + 100
        ]),
        meta: { types: ['symbol', 'timestamp', 'float', 'long'], count: 50 }
      };
    }
    
    if (isQuotesQuery) {
      return {
        columns: ['sym', 'time', 'bid', 'ask', 'bsize', 'asize'],
        data: Array.from({ length: 50 }, (_, i) => [
          ['AAPL', 'GOOGL', 'MSFT', 'TSLA'][i % 4],
          new Date(Date.now() - Math.random() * 86400000).toISOString(),
          Math.random() * 200 + 100,
          Math.random() * 200 + 101,
          Math.floor(Math.random() * 1000) + 100,
          Math.floor(Math.random() * 1000) + 100
        ]),
        meta: { types: ['symbol', 'timestamp', 'float', 'float', 'long', 'long'], count: 50 }
      };
    }

    // Default mock result
    return {
      columns: ['col1', 'col2', 'col3'],
      data: Array.from({ length: 20 }, (_, i) => [
        `value${i}`,
        Math.random() * 100,
        new Date().toISOString()
      ]),
      meta: { types: ['string', 'float', 'timestamp'], count: 20 }
    };
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