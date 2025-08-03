import { useState, useEffect, useCallback, useRef } from 'react';
import { KdbApiService } from '@/services/kdb-api';
import { ConnectionStatus, KdbTable, KdbQueryResult } from '@/types/kdb';

export function useKdbConnection() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<KdbTable[]>([]);
  const serviceRef = useRef<KdbApiService | null>(null);

  useEffect(() => {
    serviceRef.current = new KdbApiService();
    
    const unsubscribeStatus = serviceRef.current.onStatusChange(setStatus);
    const unsubscribeError = serviceRef.current.onError(setError);

    return () => {
      unsubscribeStatus();
      unsubscribeError();
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }
    };
  }, []);

  const connect = useCallback(async (host: string, port: number, browseTables: boolean = false) => {
    if (!serviceRef.current) return false;
    
    try {
      setError(null);
      const success = await serviceRef.current.connect(host, port);
      if (success && browseTables) {
        const tablesList = await serviceRef.current.getTables();
        setTables(tablesList);
      } else if (success && !browseTables) {
        setTables([]); // Clear tables if not browsing
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      setTables([]);
      setError(null);
    }
  }, []);

  const executeQuery = useCallback(async (query: string): Promise<KdbQueryResult> => {
    if (!serviceRef.current) {
      throw new Error('Connection service not initialized');
    }
    return serviceRef.current.executeQuery(query);
  }, []);

  const getTableData = useCallback(async (tableName: string, offset: number = 0, limit: number = 100): Promise<KdbQueryResult> => {
    if (!serviceRef.current) {
      throw new Error('Connection service not initialized');
    }
    return serviceRef.current.getTableData(tableName, offset, limit);
  }, []);

  const refreshTables = useCallback(async () => {
    if (!serviceRef.current || !serviceRef.current.isConnected()) return;
    
    try {
      const tablesList = await serviceRef.current.getTables();
      setTables(tablesList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh tables');
    }
  }, []);

  const cancelConnection = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.cancelConnection();
    }
  }, []);

  const cancelQuery = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.cancelQuery();
    }
  }, []);

  return {
    status,
    error,
    tables,
    connect,
    disconnect,
    cancelConnection,
    cancelQuery,
    executeQuery,
    getTableData,
    refreshTables,
    isConnected: status === 'connected'
  };
}