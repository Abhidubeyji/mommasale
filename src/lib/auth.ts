import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { compare } from "bcrypt"
import { randomUUID } from "crypto"
import { ensureDsrEnabledColumn, ensureLoginLogsTable } from "@/lib/dsr-db"

// Helper function to create login log (using raw SQL for reliability)
async function createLoginLog(userId: string, success: boolean) {
  try {
    // First ensure the login_logs table exists
    await ensureLoginLogsTable()
    
    // Use raw SQL to insert login log
    await db.$executeRawUnsafe(
      `INSERT INTO "login_logs" ("id", "userId", "loginTime", "success") VALUES ($1, $2, $3, $4);`,
      randomUUID(),
      userId,
      new Date(),
      success
    )
    console.log(`Login log created for user ${userId}, success: ${success}`)
  } catch (error) {
    console.error("Failed to create login log:", error)
    // Fallback: try Prisma
    try {
      await db.loginLog.create({
        data: {
          id: randomUUID(),
          userId,
          success,
          loginTime: new Date()
        }
      })
    } catch (prismaErr) {
      console.error("Prisma login log also failed:", prismaErr)
    }
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
        
        // Ensure dsrEnabled column exists, then read its value (using raw SQL)
        let dsrEnabled = false
        try {
          await ensureDsrEnabledColumn()
          const result = await db.$queryRaw<Array<{ dsrEnabled: boolean }>>`
            SELECT COALESCE("dsrEnabled", false) as "dsrEnabled" FROM "users" WHERE "id" = ${user.id};
          `
          dsrEnabled = result[0]?.dsrEnabled ?? false
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
