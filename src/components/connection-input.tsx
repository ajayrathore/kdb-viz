import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plug, PlugZap, AlertCircle } from 'lucide-react';
import { ConnectionStatus } from '@/types/kdb';

interface ConnectionInputProps {
  connectionData: { host: string; port: number } | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  onConnect: (host: string, port: number) => Promise<boolean>;
  onDisconnect: () => void;
}

export function ConnectionInput({
  connectionData,
  connectionStatus,
  connectionError,
  onConnect,
  onDisconnect,
}: ConnectionInputProps) {
  const [hostPort, setHostPort] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Update input when connectionData changes
  useEffect(() => {
    if (connectionData) {
      setHostPort(`${connectionData.host}:${connectionData.port}`);
    } else {
      setHostPort('');
    }
  }, [connectionData]);

  const handleConnect = async () => {
    const trimmed = hostPort.trim();
    if (!trimmed) return;

    // Parse host:port format
    const parts = trimmed.split(':');
    if (parts.length !== 2) {
      return;
    }

    const host = parts[0].trim();
    const port = parseInt(parts[1].trim(), 10);

    if (!host || isNaN(port) || port < 1 || port > 65535) {
      return;
    }

    setIsConnecting(true);
    try {
      await onConnect(host, port);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    onDisconnect();
    setHostPort('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (connectionStatus === 'connected') {
        handleDisconnect();
      } else {
        handleConnect();
      }
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <PlugZap className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Plug className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <span className="text-sm text-muted-foreground min-w-[80px]">
          {getStatusText()}
        </span>
      </div>
      
      <div className="flex items-center space-x-2">
        <Input
          placeholder="localhost:5000"
          value={hostPort}
          onChange={(e) => setHostPort(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-32"
          disabled={isConnecting}
        />
        
        {connectionStatus === 'connected' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={isConnecting}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting || !hostPort.trim()}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </Button>
        )}
      </div>
      
      {connectionError && connectionStatus === 'error' && (
        <div className="text-sm text-red-500 max-w-xs truncate" title={connectionError}>
          {connectionError}
        </div>
      )}
    </div>
  );
}