import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Truck,
  Warehouse,
} from 'lucide-react'
import { dashboardApi, inboundOrdersApi, outboundOrdersApi, reservationsApi, sacksApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import type { DashboardSummary, InventoryReservation, Sack } from '@/types'
import { formatDateTime } from '@/lib/utils'

const PIE_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#64748b', '#ef4444']

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [sacks, setSacks] = useState<Sack[]>([])
  const [inbound, setInbound] = useState<{ createAt: string }[]>([])
  const [outbound, setOutbound] = useState<{ createAt: string }[]>([])
  const [expiring, setExpiring] = useState<InventoryReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(),
      sacksApi.all(),
      inboundOrdersApi.all(),
      outboundOrdersApi.all(),
      reservationsApi.all('Active'),
    ])
      .then(([sum, sackList, inOrders, outOrders, reservations]) => {
        setSummary(sum)
        setSacks(sackList)
        setInbound(inOrders)
        setOutbound(outOrders)
        const soon = reservations
          .filter((r) => new Date(r.expiresAt).getTime() - Date.now() < 4 * 3600000)
          .slice(0, 5)
        setExpiring(soon)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const utilization = useMemo(() => {
    if (!summary) return 0
    const occupied = summary.totalPallets > 0 ? summary.totalSacks / summary.totalPallets : 0
    return Math.min(100, Math.round(occupied * 100))
  }, [summary])

  const sackPie = useMemo(() => {
    const counts = sacks.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [sacks])

  const volumeChart = useMemo(() => {
    const hours = Array.from({ length: 8 }, (_, i) => {
      const label = `${String(i * 3).padStart(2, '0')}:00`
      const inboundCount = inbound.filter((o) => {
        const h = new Date(o.createAt).getHours()
        return h >= i * 3 && h < (i + 1) * 3
      }).length
      const outboundCount = outbound.filter((o) => {
        const h = new Date(o.createAt).getHours()
        return h >= i * 3 && h < (i + 1) * 3
      }).length
      return { hour: label, inbound: inboundCount, outbound: outboundCount }
    })
    return hours
  }, [inbound, outbound])

  if (loading) return <LoadingState message="Loading dashboard metrics..." />
  if (error || !summary) return <ErrorState message={error ?? 'Failed to load dashboard'} />

  const metrics = [
    {
      title: 'Inbound Today',
      value: summary.totalInbound,
      sub: `${summary.pendingInbound} pending`,
      icon: ArrowDownToLine,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Outbound Today',
      value: summary.totalOutbound,
      sub: 'Total orders',
      icon: ArrowUpFromLine,
      color: 'text-violet-600 bg-violet-50',
    },
    {
      title: 'Active Trips',
      value: summary.activeTrips,
      sub: `${summary.totalTrips} total trips`,
      icon: Truck,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Warehouse Utilization',
      value: `${utilization}%`,
      sub: `${summary.totalPallets} pallets / ${summary.totalZones} zones`,
      icon: Warehouse,
      color: 'text-amber-600 bg-amber-50',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Real-time KPIs and system overview across the logistics network."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.title}>
            <CardContent className="flex items-start gap-4 p-6">
              <div className={`rounded-xl p-3 ${m.color}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{m.title}</p>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs text-slate-400">{m.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Shipment Volume</CardTitle>
            <CardDescription>Hourly inbound vs outbound order activity</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="inbound" fill="#2563eb" name="Inbound" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" fill="#8b5cf6" name="Outbound" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sack Status Breakdown</CardTitle>
            <CardDescription>{summary.totalSacks} total sacks in network</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sackPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {sackPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-2">
              {sackPie.map((s) => (
                <Badge key={s.name} status={s.name}>
                  {s.name}: {s.value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reservation Alerts</CardTitle>
            <CardDescription>Reservations approaching expiration</CardDescription>
          </CardHeader>
          <CardContent>
            {expiring.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No urgent reservation alerts.</p>
            ) : (
              <ul className="space-y-3">
                {expiring.map((r) => (
                  <li
                    key={r.reservationId}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{r.reservationId}</p>
                      <p className="text-xs text-slate-500">
                        Order {r.outboundOrderId} · Sack {r.sackId}
                      </p>
                    </div>
                    <div className="text-right text-xs text-amber-700">
                      Expires {formatDateTime(r.expiresAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest audit log entries</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.recentLogs.map((log) => (
                <li key={log.auditLogId} className="flex items-start gap-3 rounded-lg border px-4 py-3">
                  <Package className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{log.userName}</span>{' '}
                      <Badge status={log.actionType}>{log.actionType}</Badge>{' '}
                      <span className="text-slate-500">{log.tableName}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {log.recordId} · {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
