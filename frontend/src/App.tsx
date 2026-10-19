import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ApiStatus = 'checking' | 'online' | 'offline'

async function fetchApiStatus(): Promise<ApiStatus> {
  try {
    const response = await fetch('/api/health')
    return response.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

function App() {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    void fetchApiStatus().then(setStatus)
  }, [])

  const recheck = () => {
    setStatus('checking')
    void fetchApiStatus().then(setStatus)
  }

  return (
    <main className="bg-muted flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>School Management System</CardTitle>
          <CardDescription>Project setup check</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm">
            API status: <span className="font-medium">{status}</span>
          </p>
          <Button variant="outline" size="sm" onClick={recheck}>
            Check again
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

export default App
