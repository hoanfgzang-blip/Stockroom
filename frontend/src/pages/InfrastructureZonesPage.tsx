import { useEffect, useMemo, useState } from 'react'
import { palletsApi, zonesApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { zoneProcessRoleDescription, zoneProcessRoleLabel } from '@/lib/zoneFlow'
import type { Pallet, Zone } from '@/types'

export default function InfrastructureZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState(false)

  useEffect(() => {
    Promise.all([zonesApi.all(), palletsApi.all()])
      .then(([z, p]) => {
        setZones(z)
        const operationalZoneIds = new Set(z.map((zone) => zone.zoneId))
        setPallets(p.filter((pallet) => operationalZoneIds.has(pallet.zoneId)))
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

  const updateProcessRole = async (processRole: string) => {
    if (!selectedZoneData || savingRole) return

    setSavingRole(true)
    try {
      const updated = { ...selectedZoneData, processRole }
      await zonesApi.update(updated.zoneId, updated)
      setZones((current) => current.map((zone) => zone.zoneId === updated.zoneId ? updated : zone))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Không thể cập nhật vai trò zone.')
    } finally {
      setSavingRole(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Zone A/B/C và pallet"
        description="Theo dõi chờ chia chọn nội tỉnh, outbound nội tỉnh và outbound ngoại tỉnh."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Sơ đồ zone</CardTitle>
            <CardDescription>Chọn zone để xem các pallet</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {zones.map((zone) => {
              const palletsInZone = pallets.filter((pallet) => pallet.zoneId === zone.zoneId)
              const activePallets = palletsInZone.filter((pallet) => pallet.status !== 'Empty').length
              const palletCapacity = palletsInZone.reduce((total, pallet) => total + pallet.capacity, 0)

              return (
                <button
                  key={zone.zoneId}
                  type="button"
                  onClick={() => setSelectedZone(zone.zoneId)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all hover:border-primary',
                    selectedZone === zone.zoneId && 'border-primary bg-blue-50 ring-2 ring-primary/20',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{zone.zoneName}</p>
                    <Badge status={zone.processRole}>{zoneProcessRoleLabel(zone.processRole)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{zoneProcessRoleDescription(zone.processRole)}</p>
                  <p className="mt-2 text-xs text-slate-500">{zone.location?.locationName ?? zone.locationId} · Sức chứa zone {zone.capacity}</p>
                  <p className="mt-2 text-xs text-slate-400">{activePallets}/{palletsInZone.length} pallet đang có hàng · Tổng sức chứa pallet {palletCapacity}</p>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>{selectedZoneData?.zoneName ?? 'Pallet'}</CardTitle>
              {selectedZoneData && (
                <Select
                  value={selectedZoneData.processRole}
                  onChange={(event) => void updateProcessRole(event.target.value)}
                  disabled={savingRole}
                  className="w-auto min-w-52"
                >
                  <option value="General">Khu chung</option>
                  <option value="InboundReceipt">Inbound</option>
                  <option value="LocalSortBuffer">Zone A - Chờ chia chọn nội tỉnh</option>
                  <option value="LocalOutbound">Zone B - Outbound nội tỉnh</option>
                  <option value="InterprovinceOutbound">Zone C - Outbound ngoại tỉnh</option>
                </Select>
              )}
            </div>
            <CardDescription>
              {zoneProcessRoleDescription(selectedZoneData?.processRole)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {zonePallets.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Chưa có pallet trong zone này.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {zonePallets.map((pallet) => {
                  return (
                    <div key={pallet.palletId} className="rounded-xl border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm font-semibold">{pallet.palletId}</p>
                        <Badge status={pallet.status}>{pallet.status}</Badge>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Sức chứa {pallet.capacity} · trạng thái được cập nhật theo thao tác quét.</p>
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
