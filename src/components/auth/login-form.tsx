'use client'

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"
import { Loader2, User, Lock, Flame, Leaf, CircleDot, Diamond } from "lucide-react"

export function LoginForm() {
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        userId,
        password,
        redirect: false
      })

      if (result?.error) {
        setError("Invalid User ID or password")
      } else {
        // Successful login - refresh the page to update session
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/login-bg.png)' }}
      ></div>
      {/* Dark Overlay for better readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-900/70 via-amber-900/60 to-yellow-900/70"></div>
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        
        {/* Floating Decorative Icons */}
        <div className="absolute top-16 left-16 sm:top-20 sm:left-20 w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center animate-bounce" style={{ animationDelay: '0ms', animationDuration: '3s' }}>
          <Flame className="w-7 h-7 sm:w-8 sm:h-8 text-white/80" />
        </div>
        <div className="absolute bottom-28 right-16 sm:bottom-32 sm:right-24 w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-full flex items-center justify-center animate-bounce" style={{ animationDelay: '500ms', animationDuration: '3s' }}>
          <Leaf className="w-6 h-6 sm:w-7 sm:h-7 text-white/80" />
        </div>
        <div className="absolute top-1/3 right-20 sm:right-32 w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center animate-bounce" style={{ animationDelay: '1000ms', animationDuration: '3s' }}>
          <Diamond className="w-5 h-5 sm:w-6 sm:h-6 text-white/80" />
        </div>
        <div className="absolute bottom-1/3 left-16 sm:left-28 w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-full flex items-center justify-center animate-bounce" style={{ animationDelay: '1500ms', animationDuration: '3s' }}>
          <CircleDot className="w-6 h-6 sm:w-7 sm:h-7 text-white/80" />
        </div>
        <div className="absolute top-20 right-1/4 w-8 h-8 sm:w-10 sm:h-10 bg-white/15 rounded-full flex items-center justify-center animate-bounce hidden sm:flex" style={{ animationDelay: '2000ms', animationDuration: '3s' }}>
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-white/70" />
        </div>
        <div className="absolute bottom-20 left-1/4 w-8 h-8 sm:w-10 sm:h-10 bg-white/15 rounded-full flex items-center justify-center animate-bounce hidden sm:flex" style={{ animationDelay: '2500ms', animationDuration: '3s' }}>
          <Leaf className="w-4 h-4 sm:w-5 sm:h-5 text-white/70" />
        </div>
      </div>

      {/* Main Login Card */}
      <Card className="relative w-full max-w-md mx-3 sm:mx-4 shadow-2xl border-0 bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl overflow-hidden">
        {/* Top Decorative Bar */}
        <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"></div>
        
        <CardContent className="p-5 sm:p-8">
          {/* Logo & Branding */}
          <div className="text-center mb-5 sm:mb-8">
            <div className="relative inline-block mb-3 sm:mb-4">
              <Image 
                src="/logo.png" 
                alt="Mom Masale" 
                width={80} 
                height={80}
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent mb-1">
              Mom Masale
            </h1>
            <p className="text-gray-500 text-sm">Order Management System</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-xl">
                <AlertDescription className="text-red-600">{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="userId" className="text-gray-700 font-medium">User ID</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-400" />
                <Input
                  id="userId"
                  type="text"
                  placeholder="Enter your User ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  className="pl-12 h-11 sm:h-12 border-2 border-orange-100 focus:border-orange-400 focus:ring-orange-400 rounded-xl bg-orange-50/50 placeholder:text-gray-400"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-12 h-11 sm:h-12 border-2 border-orange-100 focus:border-orange-400 focus:ring-orange-400 rounded-xl bg-orange-50/50 placeholder:text-gray-400"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-11 sm:h-12 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-orange-100 text-center">
            <p className="text-gray-400 text-xs sm:text-sm mb-1">
              © 2024 Mom Masale. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Developed by <span className="font-semibold text-orange-600">Intech IT Solution</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
