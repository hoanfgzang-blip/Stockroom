import { useEffect, useState } from 'react'
import { inboundOrdersApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Drawer } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { cn, formatDateTime } from '@/lib/utils'
import type { InboundOrder, InboundOrderItem } from '@/types'

export default function InboundOrdersPage() {
  const [orders, setOrders] = useState<InboundOrder[]>([])
  const [selected, setSelected] = useState<InboundOrder | null>(null)
  const [items, setItems] = useState<InboundOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    inboundOrdersApi
      .all()
      .then(setOrders)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const openDetail = async (order: InboundOrder) => {
    setSelected(order)
    try {
      const data = await inboundOrdersApi.withItems(order.inboundOrderId)
      setItems(data.items)
    } catch {
      setItems([])
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Inbound Orders"
        description="Receive shipments and track associated sacks and items."
      />

      <Card>
        <CardHeader>
          <CardTitle>Orders ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.inboundOrderId}
                  className={cn('cursor-pointer', selected?.inboundOrderId === order.inboundOrderId && 'bg-blue-50')}
                  onClick={() => openDetail(order)}
                >
                  <TableCell className="font-medium">{order.inboundOrderNumber}</TableCell>
                  <TableCell>{order.inboundSuplierName}</TableCell>
                  <TableCell>
                    <Badge status={order.status}>{order.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(order.createAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Inbound ${selected.inboundOrderNumber}` : 'Order Detail'}
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Supplier</p>
                <p className="font-medium">{selected.inboundSuplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <Badge status={selected.status}>{selected.status}</Badge>
              </div>
            </div>
            <div>
              <h3 className="mb-3 font-semibold">Order Items / Sacks</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">No items linked to this order.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Sack ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.inboundOrderItemId}>
                        <TableCell className="font-mono text-xs">{item.inboundOrderItemId}</TableCell>
                        <TableCell className="font-mono text-xs">{item.sackId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
