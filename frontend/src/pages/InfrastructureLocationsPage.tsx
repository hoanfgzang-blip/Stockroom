import { useEffect, useMemo, useState } from 'react'
import { locationsApi, provincesApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label, Select } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { statusLabel } from '@/lib/utils'
import type { Location, Province } from '@/types'

export default function InfrastructureLocationsPage() {
  const [tab, setTab] = useState('locations')
  const [provinces, setProvinces] = useState<Province[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [provinceFilter, setProvinceFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([provincesApi.all(), locationsApi.all()])
      .then(([p, l]) => {
        setProvinces(p)
        setLocations(l)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filteredLocations = useMemo(() => {
    if (!provinceFilter) return locations
    return locations.filter((l) => l.provinceId === provinceFilter)
  }, [locations, provinceFilter])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Quản lý hạ tầng"
        description="Tỉnh, hub kho và cấu trúc địa điểm."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger active={tab === 'locations'} onClick={() => setTab('locations')}>
            Provinces & Hubs
          </TabsTrigger>
          <TabsTrigger active={tab === 'provinces'} onClick={() => setTab('provinces')}>
            Province Registry
          </TabsTrigger>
        </TabsList>

        <TabsContent active={tab === 'locations'}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Địa điểm và hub</CardTitle>
              <div className="w-56">
                <Label className="sr-only">Lọc theo tỉnh</Label>
                <Select value={provinceFilter} onChange={(e) => setProvinceFilter(e.target.value)}>
                  <option value="">Tất cả tỉnh</option>
                  {provinces.map((p) => (
                    <option key={p.provinceId} value={p.provinceId}>
                      {p.provinceName}
                    </option>
                  ))}
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên địa điểm</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Tỉnh</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.map((loc) => (
                    <TableRow key={loc.locationId}>
                      <TableCell className="font-medium">{loc.locationName}</TableCell>
                      <TableCell>
                        <Badge status={loc.locationType}>{statusLabel(loc.locationType)}</Badge>
                      </TableCell>
                      <TableCell>{loc.province?.provinceName ?? loc.provinceId}</TableCell>
                      <TableCell className="font-mono text-xs">{loc.locationId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent active={tab === 'provinces'}>
          <Card>
            <CardHeader>
              <CardTitle>Tỉnh</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên tỉnh</TableHead>
                    <TableHead>Mã tỉnh</TableHead>
                    <TableHead>Số hub</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provinces.map((p) => (
                    <TableRow key={p.provinceId}>
                      <TableCell className="font-medium">{p.provinceName}</TableCell>
                      <TableCell className="font-mono text-xs">{p.provinceId}</TableCell>
                      <TableCell>
                        {locations.filter((l) => l.provinceId === p.provinceId).length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
