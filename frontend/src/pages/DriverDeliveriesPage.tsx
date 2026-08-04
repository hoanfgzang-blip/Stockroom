import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, MapPin, PackageCheck, Play, Truck } from 'lucide-react'
import { tripsApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { formatDateTime, statusLabel, tripColumnLabel } from '@/lib/utils'
import type { Sack, Trip } from '@/types'

export default function DriverDeliveriesPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState('')
  const [sacks, setSacks] = useState<Sack[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSacks, setLoadingSacks] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTrip = useMemo(() => trips.find((trip) => trip.tripId === selectedTripId) ?? null, [selectedTripId, trips])

  const loadTrips = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await tripsApi.mine()
      setTrips(result)
      setSelectedTripId((current) => current && result.some((trip) => trip.tripId === current)
        ? current
        : result.find((trip) => trip.status !== 'Completed' && trip.status !== 'Cancelled')?.tripId ?? result[0]?.tripId ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách chuyến giao.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadTrips() }, [])

  useEffect(() => {
    if (!selectedTripId) {
      setSacks([])
      return
    }
    setLoadingSacks(true)
    tripsApi.mySacks(selectedTripId)
      .then(setSacks)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingSacks(false))
  }, [selectedTripId])

  const updateTrip = async (status: 'InProgress' | 'Completed') => {
    if (!selectedTrip || updating) return
    setUpdating(true)
    setError(null)
    try {
      await tripsApi.updateMyStatus(selectedTrip.tripId, status)
      await loadTrips()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái chuyến.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <LoadingState />
  if (error && trips.length === 0) return <ErrorState message={error} />

  const deliveredCount = sacks.filter((sack) => sack.status === 'Received').length

  return (
    <div>
      <PageHeader title="Giao hàng của tôi" description="Chuyến được phân công cho tài khoản hiện tại." />
      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {trips.length === 0 ? (
        <Card><CardContent className="flex min-h-64 flex-col items-center justify-center text-center"><Truck className="h-10 w-10 text-slate-300" /><p className="mt-4 font-medium text-slate-800">Chưa có chuyến được phân công</p><p className="mt-1 text-sm text-slate-500">Liên hệ điều phối để nhận chuyến giao hàng.</p></CardContent></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
          <section className="space-y-3" aria-label="Danh sách chuyến giao">
            {trips.map((trip) => {
              const active = trip.tripId === selectedTripId
              return <button key={trip.tripId} type="button" onClick={() => setSelectedTripId(trip.tripId)} className={`w-full rounded-lg border p-4 text-left transition-colors ${active ? 'border-primary bg-blue-50 ring-2 ring-primary/15' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between gap-3"><p className="font-mono text-xs font-semibold text-primary">{trip.tripId}</p><Badge status={trip.status}>{tripColumnLabel(trip.status)}</Badge></div>
                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-800"><span className="min-w-0 truncate">{trip.origin}</span><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 truncate">{trip.destination}</span></div>
                <p className="mt-2 text-xs text-slate-500">Khởi tạo: {formatDateTime(trip.createdAt)}</p>
              </button>
            })}
          </section>

          {selectedTrip && <section className="space-y-5" aria-label="Chi tiết chuyến giao">
            <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" />Chuyến {selectedTrip.tripId}</CardTitle><CardDescription className="mt-2">Phương tiện: {selectedTrip.carId} · Loại chuyến: {selectedTrip.type}</CardDescription></div><Badge status={selectedTrip.status}>{tripColumnLabel(selectedTrip.status)}</Badge></div></CardHeader><CardContent>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-medium uppercase text-slate-500">Điểm lấy hàng</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-slate-500" />{selectedTrip.origin}</p></div><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-medium uppercase text-slate-500">Điểm giao</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />{selectedTrip.destination}</p></div></div>
              <div className="mt-5 flex flex-wrap gap-3">{selectedTrip.status === 'Pending' && <Button onClick={() => void updateTrip('InProgress')} disabled={updating}><Play className="h-4 w-4" />Bắt đầu chuyến</Button>}{selectedTrip.status === 'InProgress' && <Button onClick={() => void updateTrip('Completed')} disabled={updating}><CheckCircle2 className="h-4 w-4" />Hoàn tất chuyến</Button>}</div>
            </CardContent></Card>

            <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-5 w-5 text-primary" />Bao hàng trên chuyến</CardTitle><span className="text-sm text-slate-500">{deliveredCount}/{sacks.length} đã giao</span></div></CardHeader><CardContent>
              {loadingSacks ? <p className="py-8 text-center text-sm text-slate-500">Đang tải bao hàng...</p> : sacks.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Chuyến này chưa có bao hàng.</p> : <ul className="divide-y divide-slate-100">{sacks.map((sack) => <li key={sack.sackId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="font-mono text-sm font-semibold text-slate-800">{sack.sackId}</p><p className="mt-1 text-xs text-slate-500">Điểm đến: {sack.sDestination}</p></div><div className="flex shrink-0 items-center gap-2"><Circle className={`h-3 w-3 ${sack.status === 'Received' ? 'fill-emerald-500 text-emerald-500' : 'text-slate-300'}`} /><Badge status={sack.status}>{statusLabel(sack.status)}</Badge></div></li>)}</ul>}
            </CardContent></Card>
          </section>}
        </div>
      )}
    </div>
  )
}
