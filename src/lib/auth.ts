import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { compare } from "bcrypt"

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
          return null
        }

        const passwordMatch = await compare(credentials.password, user.password)
        console.log("Password match:", passwordMatch)

        if (!passwordMatch) {
          console.log("Password mismatch")
          return null
        }

        console.log("Login successful for user:", user.id)
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
  secret: process.env.NEXTAUTH_SECRET || "mom-masale-secret-key-2024-super-secure",
  debug: true
}
