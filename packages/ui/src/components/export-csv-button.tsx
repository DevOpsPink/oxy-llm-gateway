'use client'

/**
 * CSV EXPORT BUTTON
 * =================
 * 
 * Lets finance teams export usage data for audit.
 * 
 * One-click export (no modal, no form), placed in the dashboard header.
 * SECURITY: JWT auth enforced by backend (RLS + rate limit).
 */

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from 'lucide-react'
import { toast } from "sonner"
import { createClient } from '@/lib/supabase/client'

export function ExportCSVButton() {
  const [isExporting, setIsExporting] = useState(false)
  const supabase = createClient()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      // Get JWT token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Session expired. Please log in again.')
        return
      }

      // Calculate default date range (last 30 days)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      // Call backend export endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }

      const url = `${apiUrl}/api/v1/reports/export?start_date=${startDateStr}&end_date=${endDateStr}`
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!res.ok) {
        // Parse error
        const errorData = await res.json().catch(() => ({ detail: 'Export failed' }))
        throw new Error(errorData.detail || 'Export failed')
      }

      // Download the CSV file
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `oxy_usage_${startDateStr}_to_${endDateStr}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      toast.success('Export Complete', {
        description: `Downloaded usage data for ${startDateStr} to ${endDateStr}`,
        duration: 5000
      })

    } catch (error) {
      console.error('CSV Export Error:', error)
      toast.error('Export Failed', {
        description: error instanceof Error ? error.message : 'Unable to export data. Please try again.',
        duration: 7000
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="hover-lift"
      title="Export usage data (last 30 days)"
      aria-label="Export usage data as CSV"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </>
      )}
    </Button>
  )
}

