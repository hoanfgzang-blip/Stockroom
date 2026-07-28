import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { locationsApi, routingRulesApi } from '@/api/services'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import type { Location, RoutingRule } from '@/types'

export default function RoutingRulesPage() {
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([routingRulesApi.all(), locationsApi.all()])
      .then(([r, l]) => {
        setRules(r)
        setLocations(l)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const locName = (id: string) => locations.find((l) => l.locationId === id)?.locationName ?? id

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Quy tắc định tuyến"
        description="Thiết lập quy tắc điều phối từ hub đến điểm đến."
      />

      <Card>
        <CardHeader>
          <CardTitle>Mạng lưới tuyến ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã quy tắc</TableHead>
                <TableHead>Tuyến điều phối</TableHead>
                <TableHead>Điểm tiếp theo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.ruleId}>
                  <TableCell className="font-mono text-xs">{rule.ruleId}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-lg bg-blue-50 px-2 py-1 font-medium text-blue-700">
                        {locName(rule.currentLocationID)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                      <span className="rounded-lg bg-violet-50 px-2 py-1 font-medium text-violet-700">
                        {locName(rule.cDestinationID)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-sm font-medium text-emerald-700">
                      → {locName(rule.nextHop)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
