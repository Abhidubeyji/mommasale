'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requestNotificationPermission, getNotificationPermission, isNotificationSupported } from '@/lib/firebase'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

export function NotificationSetup() {
  const { data: session } = useSession()
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    // Check if notifications are supported
    const isSupported = isNotificationSupported()
    setSupported(isSupported)

    if (isSupported) {
      setPermission(getNotificationPermission())
    }
  }, [])

  const handleEnableNotifications = async () => {
    if (!supported) {
      toast.error('Browser notifications are not supported in this browser')
      return
    }

    setLoading(true)
    try {
      const token = await requestNotificationPermission()

      if (token) {
        // Save token to database
        const response = await fetch('/api/fcm-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        })

        if (response.ok) {
          setPermission('granted')
          toast.success('Notifications enabled successfully!')
        } else {
          toast.error('Failed to save notification settings')
        }
      } else {
        toast.error('Failed to get notification permission')
      }
    } catch (error) {
      console.error('Error enabling notifications:', error)
      toast.error('Failed to enable notifications')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/fcm-token', {
        method: 'DELETE',
      })

      if (response.ok) {
        setPermission(getNotificationPermission())
        toast.success('Notifications disabled')
      } else {
        toast.error('Failed to disable notifications')
      }
    } catch (error) {
      console.error('Error disabling notifications:', error)
      toast.error('Failed to disable notifications')
    } finally {
      setLoading(false)
    }
  }

  // Only show for ADMIN and VIEWER roles
  if (session?.user?.role === 'SALES') {
    return null
  }

  if (!supported) {
    return (
      <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="h-5 w-5" />
            Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser doesn&apos;t support push notifications. Please use a modern browser like Chrome, Firefox, or Edge.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-orange-200 dark:border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-orange-500" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified when a new order is placed. Works even when the app is closed!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {permission === 'granted' ? (
              <>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Enabled</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You will receive notifications for new orders
                </p>
              </>
            ) : permission === 'denied' ? (
              <>
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <BellOff className="h-5 w-5" />
                  <span className="font-medium">Blocked</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Notifications are blocked. Please enable them in your browser settings.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <Bell className="h-5 w-5" />
                  <span className="font-medium">Not Enabled</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enable notifications to get alerts for new orders
                </p>
              </>
            )}
          </div>

          <div className="flex gap-2">
            {permission === 'granted' ? (
              <Button
                variant="outline"
                onClick={handleDisableNotifications}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <BellOff className="h-4 w-4 mr-2" />
                )}
                Disable
              </Button>
            ) : permission !== 'denied' ? (
              <Button
                onClick={handleEnableNotifications}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Bell className="h-4 w-4 mr-2" />
                )}
                Enable Notifications
              </Button>
            ) : null}
          </div>
        </div>

        {permission === 'denied' && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm">
            <p className="text-red-700 dark:text-red-300">
              <strong>How to enable notifications:</strong>
            </p>
            <ol className="list-decimal list-inside mt-2 text-red-600 dark:text-red-400">
              <li>Click the lock icon in your browser&apos;s address bar</li>
              <li>Find &quot;Notifications&quot; in the permissions list</li>
              <li>Change it to &quot;Allow&quot;</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
