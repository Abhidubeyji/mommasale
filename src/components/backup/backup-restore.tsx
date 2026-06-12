'use client'

import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Database, Download, Upload, AlertTriangle, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ImportResult {
  message: string
  results: {
    users: { imported: number; skipped: number }
    categories: { imported: number; skipped: number }
    products: { imported: number; skipped: number }
    shopkeepers: { imported: number; skipped: number }
    orders: { imported: number; skipped: number }
    orderItems: { imported: number; skipped: number }
    payments: { imported: number; skipped: number }
    outstanding: { imported: number; skipped: number }
    units: { imported: number; skipped: number }
  }
}

export function BackupRestore() {
  const { data: session } = useSession()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [resultDialogOpen, setResultDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Import options
  const [importOptions, setImportOptions] = useState({
    users: true,
    categories: true,
    products: true,
    shopkeepers: true,
    orders: true,
    orderItems: true,
    payments: true,
    outstanding: true,
    units: true,
  })

  const handleExport = async () => {
    try {
      setExporting(true)
      const res = await fetch("/api/backup")
      
      if (res.ok) {
        const data = await res.json()
        
        // Create downloadable JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `mom-masale-backup-${format(new Date(), "yyyy-MM-dd-HHmmss")}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
        
        toast.success("Backup exported successfully")
      } else {
        toast.error("Failed to export backup")
      }
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export backup")
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith(".json")) {
      toast.error("Please upload a JSON backup file")
      return
    }

    if (!confirm("Are you sure you want to restore from this backup? This will add data to your database. Existing records with same IDs will be skipped.")) {
      return
    }

    setImporting(true)

    try {
      const text = await file.text()
      const backupData = JSON.parse(text)

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: backupData.data,
          options: importOptions
        })
      })

      const data = await res.json()

      if (res.ok) {
        setImportResult(data)
        setResultDialogOpen(true)
        toast.success("Backup restored successfully")
      } else {
        toast.error(data.error || "Failed to restore backup")
      }
    } catch (error) {
      console.error("Import error:", error)
      toast.error("Failed to restore backup. Make sure the file is a valid backup JSON.")
    } finally {
      setImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const toggleOption = (key: string) => {
    setImportOptions(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
  }

  return (
    <div className="space-y-4 sm:space-y-6 h-full flex flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
          Backup & Restore
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">Export and import your database</p>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 flex-1">
        {/* Export Card */}
        <Card className="border-orange-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-orange-500" />
              Export Backup
            </CardTitle>
            <CardDescription>
              Download all your data as a JSON file. This includes users, products, orders, and all other data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Export includes:</strong>
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {["Users", "Categories", "Products", "Shopkeepers", "Orders", "Payments", "Outstanding"].map(item => (
                  <Badge key={item} variant="secondary">{item}</Badge>
                ))}
              </div>
            </div>
            <Button 
              onClick={handleExport} 
              disabled={exporting}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Backup
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Import Card */}
        <Card className="border-orange-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              Restore Backup
            </CardTitle>
            <CardDescription>
              Import data from a previously exported backup file. Records with existing IDs will be skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Warning</p>
                  <p className="text-amber-700 dark:text-amber-300">Import will ADD data to your database. Make sure to export a backup first.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Select what to import:</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(importOptions).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={value}
                      onCheckedChange={() => toggleOption(key)}
                    />
                    <Label htmlFor={key} className="text-sm capitalize">{key}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button 
                disabled={importing}
                variant="outline"
                className="w-full border-orange-500 text-orange-500 hover:bg-orange-50"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-2"></div>
                    Restoring...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Select Backup File
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Result Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Restore Complete
            </DialogTitle>
            <DialogDescription>
              {importResult?.message}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {importResult?.results && Object.entries(importResult.results).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center py-2 border-b">
                <span className="capitalize font-medium">{key}</span>
                <div className="flex gap-4">
                  <span className="text-green-600">Imported: {value.imported}</span>
                  {value.skipped > 0 && (
                    <span className="text-amber-600">Skipped: {value.skipped}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setResultDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading overlay for import */}
      {importing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-64">
            <CardContent className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-sm">Restoring backup...</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
