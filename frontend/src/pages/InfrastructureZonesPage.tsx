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
            <CardTitle>Zone Map</CardTitle>
            <CardDescription>Select a zone to view pallets</CardDescription>
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
              Click zone cards to explore pallet occupancy and utilization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {zonePallets.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No pallets in this zone.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {zonePallets.map((pallet) => {
                  const utilization = pallet.status === 'Occupied' ? 75 : pallet.status === 'Full' ? 100 : 15
                  return (
                    <div key={pallet.palletId} className="rounded-xl border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm font-semibold">{pallet.palletId}</p>
                        <Badge status={pallet.status}>{pallet.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Capacity: {pallet.capacity} kg</p>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>Utilization</span>
                          <span>{utilization}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              utilization >= 90 ? 'bg-red-500' : utilization >= 50 ? 'bg-amber-500' : 'bg-emerald-500',
                            )}
                            style={{ width: `${utilization}%` }}
                          />
                        </div>
                      </div>
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
