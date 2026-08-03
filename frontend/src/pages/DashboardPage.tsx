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
  Calendar as CalendarIcon,
  Package,
  Truck,
  Warehouse,
} from 'lucide-react'
import { dashboardApi, inboundOrdersApi, outboundOrdersApi, reservationsApi, sacksApi, tripsApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import type { DashboardSummary, InboundOrder, InventoryReservation, OutboundOrder, Sack, Trip } from '@/types'
import { formatDateTime } from '@/lib/utils'

const PIE_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#64748b', '#ef4444']

type TimePeriod = 'week' | 'month' | 'year' | 'custom'

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [sacks, setSacks] = useState<Sack[]>([])
  const [inbound, setInbound] = useState<InboundOrder[]>([])
  const [outbound, setOutbound] = useState<OutboundOrder[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [expiring, setExpiring] = useState<InventoryReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [period, setPeriod] = useState<TimePeriod>('month')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(),
      sacksApi.all(),
      inboundOrdersApi.all(),
      outboundOrdersApi.all(),
      tripsApi.all(),
      reservationsApi.all('Active'),
    ])
      .then(([sum, sackList, inOrders, outOrders, tripList, reservations]) => {
        setSummary(sum)
        setSacks(sackList)
        setInbound(inOrders)
        setOutbound(outOrders)
        setTrips(tripList)
        const soon = reservations
          .filter((r) => new Date(r.expiresAt).getTime() - Date.now() < 4 * 3600000)
          .slice(0, 5)
        setExpiring(soon)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Determine active date range [startMs, endMs]
  const dateRange = useMemo(() => {
    const now = new Date()
    let start = new Date()
    let end = new Date()

    if (period === 'week') {
      const day = now.getDay()
      const diffToMonday = (day === 0 ? -6 : 1 - day)
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (diffToMonday + 6), 23, 59, 59, 999)
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    } else if (period === 'custom') {
      if (startDate) {
        start = new Date(startDate + 'T00:00:00')
      } else {
        start = new Date(0)
      }
      if (endDate) {
        end = new Date(endDate + 'T23:59:59.999')
      } else {
        end = new Date()
      }
    }

    return { start, end }
  }, [period, startDate, endDate])

  const filteredInbound = useMemo(() => {
    return inbound.filter((o) => {
      const time = new Date(o.createAt).getTime()
      return time >= dateRange.start.getTime() && time <= dateRange.end.getTime()
    })
  }, [inbound, dateRange])

  const filteredOutbound = useMemo(() => {
    return outbound.filter((o) => {
      const time = new Date(o.createAt).getTime()
      return time >= dateRange.start.getTime() && time <= dateRange.end.getTime()
    })
  }, [outbound, dateRange])

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const time = t.createdAt ? new Date(t.createdAt).getTime() : 0
      return time >= dateRange.start.getTime() && time <= dateRange.end.getTime()
    })
  }, [trips, dateRange])

  const metrics = useMemo(() => {
    if (!summary) return []
    const pendingInboundCount = filteredInbound.filter((o) => o.status === 'Pending').length
    const activeTripCount = filteredTrips.filter((t) => t.status === 'InProgress').length
    const occupied = summary.totalPallets > 0 ? summary.totalSacks / summary.totalPallets : 0
    const util = Math.min(100, Math.round(occupied * 100))

    let periodLabel = 'trong tuần này'
    if (period === 'month') periodLabel = 'trong tháng này'
    if (period === 'year') periodLabel = 'trong năm nay'
    if (period === 'custom') periodLabel = 'trong khoảng thời gian chọn'

    return [
      {
        title: 'Nhập kho',
        value: filteredInbound.length,
        sub: `${pendingInboundCount} đơn đang chờ (${periodLabel})`,
        icon: ArrowDownToLine,
        color: 'text-blue-600 bg-blue-50',
      },
      {
        title: 'Xuất kho',
        value: filteredOutbound.length,
        sub: `Tổng đơn xuất (${periodLabel})`,
        icon: ArrowUpFromLine,
        color: 'text-violet-600 bg-violet-50',
      },
      {
        title: 'Chuyến xe vận chuyển',
        value: filteredTrips.length,
        sub: `${activeTripCount} chuyến đang chạy (${periodLabel})`,
        icon: Truck,
        color: 'text-emerald-600 bg-emerald-50',
      },
      {
        title: 'Tỉ lệ lấp đầy kho',
        value: `${util}%`,
        sub: `${summary.totalPallets} pallet / ${summary.totalZones} zone`,
        icon: Warehouse,
        color: 'text-amber-600 bg-amber-50',
      },
    ]
  }, [summary, filteredInbound, filteredOutbound, filteredTrips, period])

  const sackPie = useMemo(() => {
    const counts = sacks.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [sacks])

  const volumeChart = useMemo(() => {
    if (period === 'week') {
      const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật']
      return days.map((dayName, idx) => {
        const targetDay = (idx + 1) % 7
        const inCount = filteredInbound.filter((o) => new Date(o.createAt).getDay() === targetDay).length
        const outCount = filteredOutbound.filter((o) => new Date(o.createAt).getDay() === targetDay).length
        return { label: dayName, inbound: inCount, outbound: outCount }
      })
    }

    if (period === 'month') {
      const weeks = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5']
      return weeks.map((weekName, idx) => {
        const inCount = filteredInbound.filter((o) => {
          const date = new Date(o.createAt).getDate()
          return date >= idx * 7 + 1 && date < (idx + 1) * 7 + 1
        }).length
        const outCount = filteredOutbound.filter((o) => {
          const date = new Date(o.createAt).getDate()
          return date >= idx * 7 + 1 && date < (idx + 1) * 7 + 1
        }).length
        return { label: weekName, inbound: inCount, outbound: outCount }
      })
    }

    if (period === 'year') {
      const months = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12']
      return months.map((mName, idx) => {
        const inCount = filteredInbound.filter((o) => new Date(o.createAt).getMonth() === idx).length
        const outCount = filteredOutbound.filter((o) => new Date(o.createAt).getMonth() === idx).length
        return { label: mName, inbound: inCount, outbound: outCount }
      })
    }

    const hours = Array.from({ length: 8 }, (_, i) => {
      const label = `${String(i * 3).padStart(2, '0')}:00`
      const inCount = filteredInbound.filter((o) => {
        const h = new Date(o.createAt).getHours()
        return h >= i * 3 && h < (i + 1) * 3
      }).length
      const outCount = filteredOutbound.filter((o) => {
        const h = new Date(o.createAt).getHours()
        return h >= i * 3 && h < (i + 1) * 3
      }).length
      return { label, inbound: inCount, outbound: outCount }
    })
    return hours
  }, [period, filteredInbound, filteredOutbound])

  if (loading) return <LoadingState message="Đang tải dữ liệu bảng điều khiển..." />
  if (error || !summary) return <ErrorState message={error ?? 'Không thể tải bảng điều khiển'} />

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <PageHeader
          title="Bảng điều khiển"
          description="Chỉ số hiệu suất và tổng quan hệ thống vận tải kho bãi."
        />

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2 shadow-sm">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                period === 'week' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tuần
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                period === 'month' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tháng
            </button>
            <button
              type="button"
              onClick={() => setPeriod('year')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                period === 'year' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Năm
            </button>
            <button
              type="button"
              onClick={() => setPeriod('custom')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                period === 'custom' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tùy chọn
            </button>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 border-l pl-2">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  max={endDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newStart = e.target.value
                    setStartDate(newStart)
                    if (endDate && newStart > endDate) {
                      setEndDate(newStart)
                    }
                  }}
                  className="rounded border px-2 py-1 text-xs outline-none focus:border-primary"
                />
              </div>
              <span className="text-xs text-slate-400">đến</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  const newEnd = e.target.value
                  setEndDate(newEnd)
                  if (startDate && newEnd < startDate) {
                    setStartDate(newEnd)
                  }
                }}
                className="rounded border px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      </div>

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
            <CardTitle>Sản lượng hàng hóa</CardTitle>
            <CardDescription>
              Thống kê hoạt động đơn nhập và xuất {period === 'week' ? 'theo các ngày trong tuần' : period === 'month' ? 'theo tuần trong tháng' : period === 'year' ? 'theo tháng trong năm' : 'trong khoảng thời gian đã chọn'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="inbound" fill="#2563eb" name="Nhập hàng" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" fill="#8b5cf6" name="Xuất hàng" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phân bố trạng thái bao hàng</CardTitle>
            <CardDescription>Tổng số {summary.totalSacks} bao hàng trong hệ thống</CardDescription>
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
            <CardTitle>Cảnh báo giữ hàng</CardTitle>
            <CardDescription>Các lượt giữ hàng sắp hết hạn</CardDescription>
          </CardHeader>
          <CardContent>
            {expiring.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Không có cảnh báo giữ hàng khẩn cấp.</p>
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
                        Đơn xuất {r.outboundOrderId} · Bao hàng {r.sackId}
                      </p>
                    </div>
                    <div className="text-right text-xs text-amber-700">
                      Hết hạn {formatDateTime(r.expiresAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
            <CardDescription>Các bản ghi nhật ký mới nhất</CardDescription>
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
