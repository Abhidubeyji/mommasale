import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

// Firebase Admin SDK initialization
let firebaseApp: ReturnType<typeof initializeApp> | undefined

function getFirebaseApp() {
  if (getApps().length === 0) {
    // Initialize with service account from environment variable
    // You need to set FIREBASE_SERVICE_ACCOUNT in your .env file
    // Get this from Firebase Console > Project Settings > Service Accounts
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT

    if (serviceAccount) {
      firebaseApp = initializeApp({
        credential: cert(JSON.parse(serviceAccount))
      })
    } else {
      console.warn('FIREBASE_SERVICE_ACCOUNT not set. Push notifications will not work.')
    }
  }
  return getApps()[0]
}

// Send push notification to all admins
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, body: messageBody, orderId, amount, shopkeeperName } = body

    // Get all admin users with FCM tokens
    const admins = await db.user.findMany({
      where: {
        role: "ADMIN",
        isActive: true,
        fcmToken: { not: null }
      },
      select: { fcmToken: true, name: true }
    })

    // Also get viewers who may want notifications
    const viewers = await db.user.findMany({
      where: {
        role: "VIEWER",
        isActive: true,
        fcmToken: { not: null }
      },
      select: { fcmToken: true, name: true }
    })

    const allRecipients = [...admins, ...viewers]

    if (allRecipients.length === 0) {
      console.log("[FCM] No users with FCM tokens found")
      return NextResponse.json({
        success: true,
        message: "No users with FCM tokens. Admin needs to enable notifications first."
      })
    }

    // Prepare notification payload
    const notificationTitle = title || "🛒 ONE ORDER FOUND , नया Order प्राप्त हुआ!"
    const notificationBody = messageBody || `Order #${orderId || 'New'} - ${shopkeeperName || 'Unknown'} - ₹${amount || '0'}`

    const tokens = allRecipients
      .filter(user => user.fcmToken)
      .map(user => user.fcmToken!)

    // Check if Firebase Admin is initialized
    const app = getFirebaseApp()

    if (!app) {
      // Fallback: Log notification for manual delivery
      console.log("[FCM] Firebase Admin not initialized. Notification would be sent:")
      console.log(`  Title: ${notificationTitle}`)
      console.log(`  Body: ${notificationBody}`)
      console.log(`  Recipients: ${tokens.length}`)

      // Return success but indicate notifications weren't delivered
      return NextResponse.json({
        success: true,
        delivered: false,
        message: "Firebase service account not configured. See README for setup instructions.",
        recipientCount: tokens.length
      })
    }

    // Send multicast message using Firebase Admin SDK
    const messaging = getMessaging(app)

    const message = {
      notification: {
        title: notificationTitle,
        body: notificationBody
      },
      data: {
        orderId: orderId || '',
        amount: amount?.toString() || '',
        shopkeeperName: shopkeeperName || '',
        click_action: '/orders',
        timestamp: new Date().toISOString()
      },
      tokens: tokens,
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          vibrate: [200, 100, 200],
          tag: `order-${orderId || Date.now()}`,
          renotify: true,
          requireInteraction: true,
          actions: [
            { action: 'view', title: 'View Order' },
            { action: 'close', title: 'Close' }
          ]
        },
        fcmOptions: {
          link:"/"
        }
      }
    }

    const response = await messaging.sendEachForMulticast(message)

    console.log(`[FCM] Notifications sent: ${response.successCount} success, ${response.failureCount} failed`)

    // Handle failed tokens (remove invalid ones)
    if (response.failureCount > 0) {
      const failedTokens: string[] = []
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM] Failed to send to token ${tokens[idx]}:`, resp.error)
          // Remove invalid tokens
          if (resp.error?.code === 'messaging/invalid-registration-token' ||
              resp.error?.code === 'messaging/registration-token-not-registered') {
            failedTokens.push(tokens[idx])
          }
        }
      })

      // Remove invalid tokens from database
      if (failedTokens.length > 0) {
        await db.user.updateMany({
          where: { fcmToken: { in: failedTokens } },
          data: { fcmToken: null }
        })
        console.log(`[FCM] Removed ${failedTokens.length} invalid tokens`)
      }
    }

    return NextResponse.json({
      success: true,
      delivered: true,
      message: `Notifications sent to ${response.successCount} user(s)`,
      successCount: response.successCount,
      failureCount: response.failureCount
    })
  } catch (error) {
    console.error("[FCM] Send notification error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to send notifications",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Check notification status
export async function GET() {
  try {
    const app = getFirebaseApp()

    const usersWithTokens = await db.user.count({
      where: {
        OR: [
          { role: "ADMIN" },
          { role: "VIEWER" }
        ],
        isActive: true,
        fcmToken: { not: null }
      }
    })

    return NextResponse.json({
      success: true,
      firebaseInitialized: !!app,
      usersWithNotifications: usersWithTokens,
      message: app
        ? "Firebase is configured and ready"
        : "Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT environment variable."
    })
  } catch (error) {
    console.error("[FCM] Status check error:", error)
    return NextResponse.json({ error: "Failed to check notification status" }, { status: 500 })
  }
}
