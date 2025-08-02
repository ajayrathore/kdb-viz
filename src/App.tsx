import { useState } from 'react'
import { DashboardPage } from '@/pages/dashboard-page'
import { useKdbConnection } from '@/hooks/use-kdb-connection'
import { ThemeProvider } from '@/contexts/theme-context'

function App() {
  const { status, error, connect, disconnect, tables, executeQuery, getTableData } = useKdbConnection()
  const [connectionData, setConnectionData] = useState<{host: string; port: number} | null>(null)

  const handleConnect = async (host: string, port: number) => {
    const success = await connect(host, port)
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
    <ThemeProvider>
      <DashboardPage
        connectionData={connectionData}
        connectionStatus={status}
        connectionError={error}
        tables={tables}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        executeQuery={executeQuery}
        getTableData={getTableData}
      />
    </ThemeProvider>
  )
}

export default App