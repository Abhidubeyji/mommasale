import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { compare } from "bcrypt"
import { randomUUID } from "crypto"

// Helper function to create login log using raw SQL
async function createLoginLog(userId: string, success: boolean) {
  try {
    const id = randomUUID()
    const loginTime = new Date().toISOString()
    
    // Try to create table first
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS login_logs (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          success BOOLEAN NOT NULL DEFAULT true
        )
      `)
    } catch (e) {
      // Table might exist
    }

    // Insert login log
    await db.$executeRawUnsafe(`
      INSERT INTO login_logs (id, "userId", "loginTime", success)
      VALUES ('${id}', '${userId}', '${loginTime}', ${success})
    `)
    
    console.log("Login log created for user:", userId, "success:", success)
  } catch (error) {
    console.error("Failed to create login log:", error)
  }
}

declare module "next-auth" {
  interface User {
    role?: string
    canExport?: boolean
  }
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      role: string
      canExport: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    canExport: boolean
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
        if (!credentials?.userId || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { id: credentials.userId }
        })

        if (!user || !user.isActive) {
          if (user && !user.isActive) {
            await createLoginLog(user.id, false)
          }
          return null
        }

        const passwordMatch = await compare(credentials.password, user.password)

        if (!passwordMatch) {
          await createLoginLog(user.id, false)
          return null
        }

        // Log successful login
        await createLoginLog(user.id, true)
        
        return {
          id: user.id,
          email: user.email || undefined,
          name: user.name,
          role: user.role,
          canExport: user.canExport
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
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.canExport = token.canExport as boolean
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
}
