import { useEffect, useMemo, useState } from 'react'
import { palletsApi, zonesApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import type { Pallet, Zone } from '@/types'

export default function InfrastructureZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([zonesApi.all(), palletsApi.all()])
      .then(([z, p]) => {
        setZones(z)
        setPallets(p)
        if (z.length > 0) setSelectedZone(z[0].zoneId)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const zonePallets = useMemo(
    () => pallets.filter((p) => p.zoneId === selectedZone),
    [pallets, selectedZone],
  )

  const selectedZoneData = zones.find((z) => z.zoneId === selectedZone)

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Warehouse Zones & Pallets"
        description="Spatial layout of zones with pallet capacity visualization."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Sơ đồ khu vực</CardTitle>
            <CardDescription>Chọn khu vực để xem các pallet</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {zones.map((zone) => (
              <button
                key={zone.zoneId}
                type="button"
                onClick={() => setSelectedZone(zone.zoneId)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all hover:border-primary',
                  selectedZone === zone.zoneId && 'border-primary bg-blue-50 ring-2 ring-primary/20',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{zone.zoneName}</p>
                  <Badge status={zone.zoneType}>{zone.zoneType}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {zone.location?.locationName ?? zone.locationId} · Cap {zone.capacity}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {pallets.filter((p) => p.zoneId === zone.zoneId).length} pallets
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedZoneData?.zoneName ?? 'Pallets'} — Pallet Grid
            </CardTitle>
            <CardDescription>
              Click zone cards to explore pallet locations and statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {zonePallets.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No pallets in this zone.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {zonePallets.map((pallet) => {
                  return (
                    <div key={pallet.palletId} className="rounded-xl border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm font-semibold">{pallet.palletId}</p>
                        <Badge status={pallet.status}>{pallet.status}</Badge>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Trang thai duoc cap nhat theo thao tac quet cua nhan vien.</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
