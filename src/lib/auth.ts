import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { compare } from "bcrypt"
import { randomUUID } from "crypto"
import { ensureDsrEnabledColumn } from "@/lib/dsr-db"

// Helper function to create login log
async function createLoginLog(userId: string, success: boolean) {
  try {
    await db.loginLog.create({
      data: {
        id: randomUUID(),
        userId,
        success,
        loginTime: new Date()
      }
    })
  } catch (error) {
    console.error("Failed to create login log:", error)
  }
}

const isProduction = process.env.NODE_ENV === 'production'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        userId: { label: "User ID", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log("Authorize called with:", { userId: credentials?.userId })
        
        if (!credentials?.userId || !credentials?.password) {
          console.log("Missing credentials")
          return null
        }

        const user = await db.user.findUnique({
          where: { id: credentials.userId }
        })

        console.log("User found:", user ? { id: user.id, name: user.name, role: user.role, isActive: user.isActive } : null)

        if (!user || !user.isActive) {
          console.log("User not found or inactive")
          // Log failed attempt if user exists but is inactive
          if (user && !user.isActive) {
            await createLoginLog(user.id, false)
          }
          return null
        }

        const passwordMatch = await compare(credentials.password, user.password)
        console.log("Password match:", passwordMatch)

        if (!passwordMatch) {
          console.log("Password mismatch")
          // Log failed login attempt
          await createLoginLog(user.id, false)
          return null
        }

        // Log successful login
        await createLoginLog(user.id, true)
        console.log("Login successful for user:", user.id)
        
        // Ensure dsrEnabled column exists, then read its value
        let dsrEnabled = false
        try {
          await ensureDsrEnabledColumn()
          const freshUser = await db.user.findUnique({
            where: { id: user.id },
            select: { dsrEnabled: true }
          })
          dsrEnabled = freshUser?.dsrEnabled ?? false
        } catch (e) {
          console.error("Failed to read dsrEnabled:", e)
        }
        
        return {
          id: user.id,
          email: user.email || undefined,
          name: user.name,
          role: user.role,
          canExport: user.canExport,
          dsrEnabled
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.canExport = user.canExport
        token.dsrEnabled = (user as { dsrEnabled?: boolean }).dsrEnabled ?? false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.canExport = token.canExport as boolean
        ;(session.user as unknown as { dsrEnabled: boolean }).dsrEnabled = token.dsrEnabled as boolean
      }
      return session
    }
  },
  pages: {
    signIn: "/"
  },
  session: {
    strategy: "jwt"
  },
  cookies: {
    sessionToken: {
      name: `${isProduction ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "mom-masale-secret-key-2024-super-secure",
  debug: process.env.NODE_ENV === 'development'
}
