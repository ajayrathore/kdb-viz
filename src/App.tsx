import { useState } from 'react'
import { DashboardPage } from '@/pages/dashboard-page'
import { useKdbConnection } from '@/hooks/use-kdb-connection'
import { ThemeProvider } from '@/contexts/theme-context'
import { LoadingScreen } from '@/components/loading-screen'
import { useAppLoader } from '@/hooks/use-app-loader'

function AppContent() {
  const { status, error, connect, disconnect, cancelConnection, tables, executeQuery, getTableData, refreshTables } = useKdbConnection()
  const [connectionData, setConnectionData] = useState<{host: string; port: number} | null>(null)

  const handleConnect = async (host: string, port: number, browseTables: boolean = false) => {
    const success = await connect(host, port, browseTables)
    if (success) {
      setConnectionData({ host, port })
    }
    return success
  }

  const handleDisconnect = () => {
    disconnect()
    setConnectionData(null)
  }

  return (
    <DashboardPage
      connectionData={connectionData}
      connectionStatus={status}
      connectionError={error}
      tables={tables}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onCancelConnection={cancelConnection}
      executeQuery={executeQuery}
      getTableData={getTableData}
      refreshTables={refreshTables}
    />
  )
}

function App() {
  const { isLoading } = useAppLoader({
    minimumDuration: 2000, // 2 seconds minimum for the nice animation
    maximumDuration: 4000, // 4 seconds maximum to prevent infinite loading
  })
  const [showApp, setShowApp] = useState(false)

  const handleLoadingComplete = () => {
    setShowApp(true)
  }

  return (
    <ThemeProvider>
      {(isLoading || !showApp) && (
        <LoadingScreen onComplete={handleLoadingComplete} />
      )}
      {showApp && <AppContent />}
    </ThemeProvider>
  )
}

export default App