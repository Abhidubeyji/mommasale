'use client'

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClipboardList, Plus, Send } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface DsrReport {
  id: string
  serialNo: number
  counterName: string
  mobileNo: string
  address: string | null
  remark: string | null
  createdAt: string
}

const initialFormState = {
  counterName: "",
  mobileNo: "",
  address: "",
  remark: ""
}

export function DsrForm() {
  const { data: session } = useSession()
  const [reports, setReports] = useState<DsrReport[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState(initialFormState)
  const [saving, setSaving] = useState(false)
  const [locationCaptured, setLocationCaptured] = useState<{
    latitude: number | null
    longitude: number | null
    locationText: string | null
  }>({ latitude: null, longitude: null, locationText: null })
  const locationFetchedRef = useRef(false)

  useEffect(() => {
    fetchReports()
    // Capture location silently on component mount (without showing user)
    if (!locationFetchedRef.current) {
      locationFetchedRef.current = true
      captureLocation()
    }
  }, [])

  const captureLocation = () => {
    if (!navigator.geolocation) {
      // Silently fail - admin will see "Location not available"
      setLocationCaptured({ latitude: null, longitude: null, locationText: "Geolocation not supported" })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setLocationCaptured({
          latitude,
          longitude,
          locationText: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
        })
      },
      (error) => {
        // Silently fail - user should not know location capture failed
        console.log("Location capture failed (silent):", error.message)
        setLocationCaptured({ latitude: null, longitude: null, locationText: "Location unavailable" })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/dsr")
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error("Error fetching DSR reports:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Try to capture fresh location before submit
      const locationToSend = locationCaptured.latitude !== null
        ? locationCaptured
        : await new Promise<typeof locationCaptured>((resolve) => {
            if (!navigator.geolocation) {
              resolve({ latitude: null, longitude: null, locationText: "Geolocation not supported" })
              return
            }
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude } = position.coords
                resolve({
                  latitude,
                  longitude,
                  locationText: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
                })
              },
              () => {
                resolve({ latitude: null, longitude: null, locationText: "Location unavailable" })
              },
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            )
          })

      const res = await fetch("/api/dsr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterName: formData.counterName,
          mobileNo: formData.mobileNo,
          address: formData.address,
          remark: formData.remark,
          latitude: locationToSend.latitude,
          longitude: locationToSend.longitude,
          locationText: locationToSend.locationText
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || "DSR submitted successfully")
        setFormData(initialFormState)
        // Re-capture location for next submission
        captureLocation()
        fetchReports()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to submit DSR")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // If DSR is not enabled for this user, show a friendly message
  if ((session?.user as { dsrEnabled?: boolean })?.dsrEnabled === false) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Daily Sales Report
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Submit your daily sales visits</p>
        </div>
        <Card className="border-orange-200 dark:border-gray-800">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">DSR is not enabled for your account</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please contact your administrator to enable DSR access.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
          Daily Sales Report
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">Submit your daily sales visits</p>
      </div>

      <Card className="border-orange-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-orange-500" />
            New DSR Entry
          </CardTitle>
          <CardDescription>
            Fill in the details for your shop visit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="counterName">Counter Name *</Label>
                <Input
                  id="counterName"
                  value={formData.counterName}
                  onChange={(e) => setFormData({ ...formData, counterName: e.target.value })}
                  placeholder="Enter counter/shop name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mobileNo">Mobile No *</Label>
                <Input
                  id="mobileNo"
                  value={formData.mobileNo}
                  onChange={(e) => setFormData({ ...formData, mobileNo: e.target.value.replace(/[^0-9+\-\s]/g, "") })}
                  placeholder="Enter mobile number"
                  required
                  inputMode="tel"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address (optional)"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remark">Remark</Label>
              <Textarea
                id="remark"
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="Any remarks (optional)"
                rows={2}
              />
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              <Send className="mr-2 h-4 w-4" />
              {saving ? "Submitting..." : "Submit DSR"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-orange-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-orange-500" />
            My DSR Reports
          </CardTitle>
          <CardDescription>
            {reports.length} report{reports.length !== 1 ? "s" : ""} submitted
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No DSR reports yet. Submit your first report above.</p>
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
                      <TableHead className="whitespace-nowrap">Counter Name</TableHead>
                      <TableHead className="whitespace-nowrap">Mobile</TableHead>
                      <TableHead className="whitespace-nowrap">Address</TableHead>
                      <TableHead className="whitespace-nowrap">Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">#{report.serialNo}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(report.createdAt), "dd MMM yyyy, hh:mm a")}
                        </TableCell>
                        <TableCell className="font-medium">{report.counterName}</TableCell>
                        <TableCell className="whitespace-nowrap">{report.mobileNo}</TableCell>
                        <TableCell className="text-sm">{report.address || "-"}</TableCell>
                        <TableCell className="text-sm">{report.remark || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden p-3 space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            #{report.serialNo}
                          </Badge>
                          <p className="font-medium truncate">{report.counterName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(report.createdAt), "dd MMM yyyy, hh:mm a")}
                        </p>
                      </div>
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
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
