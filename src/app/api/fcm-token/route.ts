import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// POST - Save FCM token for the current user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: "FCM token is required" }, { status: 400 })
    }

    // Update the user's FCM token
    await db.user.update({
      where: { id: session.user.id },
      data: { fcmToken: token }
    })

    return NextResponse.json({ success: true, message: "FCM token saved successfully" })
  } catch (error) {
    console.error("Save FCM token error:", error)
    return NextResponse.json({ error: "Failed to save FCM token" }, { status: 500 })
  }
}

// DELETE - Remove FCM token for the current user
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Remove the user's FCM token
    await db.user.update({
      where: { id: session.user.id },
      data: { fcmToken: null }
    })

    return NextResponse.json({ success: true, message: "FCM token removed successfully" })
  } catch (error) {
    console.error("Remove FCM token error:", error)
    return NextResponse.json({ error: "Failed to remove FCM token" }, { status: 500 })
  }
}
