'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ClipboardList, Download, Trash2, MapPin, Search } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import * as XLSX from "xlsx"

interface DsrReport {
  id: string
  serialNo: number
  userId: string
  counterName: string
  mobileNo: string
  address: string | null
  remark: string | null
  latitude: number | null
  longitude: number | null
  locationText: string | null
  createdAt: string
  user: {
    id: string
    name: string
    role: string
  }
}

interface User {
  id: string
  name: string
}

export function AdminDsr() {
  const { data: session } = useSession()
  const [reports, setReports] = useState<DsrReport[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [userFilter, setUserFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<DsrReport | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchReports()
  }, [userFilter, startDate, endDate])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        // Only show sales users in filter
        setUsers(data.filter((u: User & { role: string }) => u.role === "SALES"))
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (userFilter !== "all") params.set("userId", userFilter)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)

      const res = await fetch(`/api/admin/dsr?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error("Error fetching DSR reports:", error)
      toast.error("Failed to fetch DSR reports")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // Apply client-side search filter for export
      const filteredForExport = reports.filter(report => {
        if (!searchTerm) return true
        const term = searchTerm.toLowerCase()
        return (
          report.counterName.toLowerCase().includes(term) ||
          report.mobileNo.toLowerCase().includes(term) ||
          (report.address || "").toLowerCase().includes(term) ||
          (report.remark || "").toLowerCase().includes(term) ||
          report.user.name.toLowerCase().includes(term)
        )
      })

      const excelData = filteredForExport.map((report, idx) => ({
        "S.No": idx + 1,
        "Date": format(new Date(report.createdAt), "dd MMM yyyy"),
        "Time": format(new Date(report.createdAt), "hh:mm:ss a"),
        "Sales Person": report.user.name,
        "Counter Name": report.counterName,
        "Mobile No": report.mobileNo,
        "Address": report.address || "",
        "Remark": report.remark || "",
        "Latitude": report.latitude ?? "",
        "Longitude": report.longitude ?? "",
        "Location": report.locationText || "",
        "Google Map Link": report.latitude && report.longitude
          ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
          : ""
      }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      // Set column widths
      ws["!cols"] = [
        { wch: 6 },   // S.No
        { wch: 12 },  // Date
        { wch: 14 },  // Time
        { wch: 18 },  // Sales Person
        { wch: 22 },  // Counter Name
        { wch: 14 },  // Mobile No
        { wch: 30 },  // Address
        { wch: 25 },  // Remark
        { wch: 12 },  // Latitude
        { wch: 12 },  // Longitude
        { wch: 28 },  // Location
        { wch: 40 },  // Google Map Link
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "DSR Reports")

      const fileName = `DSR_Reports_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success(`Exported ${excelData.length} reports to Excel`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export reports")
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteClick = (report: DsrReport) => {
    setReportToDelete(report)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!reportToDelete) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/dsr?id=${reportToDelete.id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("DSR report deleted successfully")
        fetchReports()
        setDeleteDialogOpen(false)
        setReportToDelete(null)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete report")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setDeleting(false)
    }
  }

  // Client-side search filter for display
  const filteredReports = reports.filter(report => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      report.counterName.toLowerCase().includes(term) ||
      report.mobileNo.toLowerCase().includes(term) ||
      (report.address || "").toLowerCase().includes(term) ||
      (report.remark || "").toLowerCase().includes(term) ||
      report.user.name.toLowerCase().includes(term)
    )
  })

  if (loading && reports.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            DSR Reports
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">View all sales DSR reports with location</p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || reports.length === 0}
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-orange-200 dark:border-gray-800">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Sales Persons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Persons</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <Label htmlFor="startDate" className="sr-only">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="sr-only">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-orange-500" />
            All DSR Reports
          </CardTitle>
          <CardDescription>
            {filteredReports.length} report{filteredReports.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredReports.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No DSR reports found. Try adjusting filters.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">S.No</TableHead>
                      <TableHead className="whitespace-nowrap">Date & Time</TableHead>
                      <TableHead className="whitespace-nowrap">Sales Person</TableHead>
                      <TableHead className="whitespace-nowrap">Counter Name</TableHead>
                      <TableHead className="whitespace-nowrap">Mobile</TableHead>
                      <TableHead className="whitespace-nowrap">Address</TableHead>
                      <TableHead className="whitespace-nowrap">Remark</TableHead>
                      <TableHead className="whitespace-nowrap">Location</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">#{report.serialNo}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(report.createdAt), "dd MMM yyyy")}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(report.createdAt), "hh:mm a")}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{report.user.name}</TableCell>
                        <TableCell className="font-medium">{report.counterName}</TableCell>
                        <TableCell className="whitespace-nowrap">{report.mobileNo}</TableCell>
                        <TableCell className="text-sm max-w-xs">{report.address || "-"}</TableCell>
                        <TableCell className="text-sm max-w-xs">{report.remark || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {report.latitude && report.longitude ? (
                            <a
                              href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs"
                              title="View on Google Maps"
                            >
                              <MapPin className="h-3 w-3" />
                              View Map
                            </a>
                          ) : (
                            <Badge variant="secondary" className="text-xs">N/A</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(report)}
                            className="hover:bg-red-100 dark:hover:bg-gray-800"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden p-3 space-y-3">
                {filteredReports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            #{report.serialNo}
                          </Badge>
                          <p className="font-medium truncate">{report.counterName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {report.user.name} • {format(new Date(report.createdAt), "dd MMM, hh:mm a")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(report)}
                        className="hover:bg-red-100 dark:hover:bg-gray-800 shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Mobile: </span>
                        <span className="font-medium">{report.mobileNo}</span>
                      </div>
                      {report.address && (
                        <div>
                          <span className="text-xs text-muted-foreground">Address: </span>
                          <span>{report.address}</span>
                        </div>
                      )}
                      {report.remark && (
                        <div>
                          <span className="text-xs text-muted-foreground">Remark: </span>
                          <span>{report.remark}</span>
                        </div>
                      )}
                      {report.latitude && report.longitude && (
                        <div>
                          <a
                            href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                          >
                            <MapPin className="h-3 w-3" />
                            View Location on Map
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete DSR Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this DSR report for "{reportToDelete?.counterName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
