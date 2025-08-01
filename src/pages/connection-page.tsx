import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Database, Loader2, AlertCircle } from 'lucide-react';
import { isValidHost, isValidPort } from '@/lib/utils';

interface ConnectionPageProps {
  onConnect: (host: string, port: number) => Promise<boolean>;
  isConnecting: boolean;
  error: string | null;
}

export function ConnectionPage({ onConnect, isConnecting, error }: ConnectionPageProps) {
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5000');
  const [validationErrors, setValidationErrors] = useState<{host?: string; port?: string}>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: {host?: string; port?: string} = {};
    
    if (!host.trim()) {
      errors.host = 'Host is required';
    } else if (!isValidHost(host.trim())) {
      errors.host = 'Invalid host format';
    }
    
    const portNum = parseInt(port, 10);
    if (!port.trim()) {
      errors.port = 'Port is required';
    } else if (isNaN(portNum) || !isValidPort(portNum)) {
      errors.port = 'Port must be between 1 and 65535';
    }
    
    setValidationErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      await onConnect(host.trim(), portNum);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">KDB+ Visualizer</CardTitle>
          <CardDescription>
            Connect to your KDB+ database to start exploring and visualizing your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="host" className="text-sm font-medium">
                Host
              </label>
              <Input
                id="host"
                type="text"
                placeholder="localhost"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className={validationErrors.host ? 'border-destructive' : ''}
                disabled={isConnecting}
              />
              {validationErrors.host && (
                <p className="text-sm text-destructive">{validationErrors.host}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="port" className="text-sm font-medium">
                Port
              </label>
              <Input
                id="port"
                type="number"
                placeholder="5000"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className={validationErrors.port ? 'border-destructive' : ''}
                disabled={isConnecting}
                min="1"
                max="65535"
              />
              {validationErrors.port && (
                <p className="text-sm text-destructive">{validationErrors.port}</p>
              )}
            </div>
            
            {error && (
              <div className="flex items-center space-x-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={isConnecting}
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
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Default KDB+ port is usually 5000</p>
            <p className="mt-1">Make sure your KDB+ process is running and accessible</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}