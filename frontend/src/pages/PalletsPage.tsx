import { useEffect, useState } from 'react'
import { palletsApi, zonesApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
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
import type { Pallet, Zone } from '@/types'

export default function PalletsPage() {
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([palletsApi.all(), zonesApi.all()])
      .then(([p, z]) => {
        setPallets(p)
        setZones(z)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const zoneName = (id: string) => zones.find((z) => z.zoneId === id)?.zoneName ?? id

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Pallet Management"
        description="Full registry of warehouse pallets with status and capacity."
      />
      <Card>
        <CardHeader>
          <CardTitle>Pallets ({pallets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pallet ID</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Capacity (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pallets.map((pallet) => (
                <TableRow key={pallet.palletId}>
                  <TableCell className="font-mono font-medium">{pallet.palletId}</TableCell>
                  <TableCell>{zoneName(pallet.zoneId)}</TableCell>
                  <TableCell>
                    <Badge status={pallet.status}>{pallet.status}</Badge>
                  </TableCell>
                  <TableCell>{pallet.capacity.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
