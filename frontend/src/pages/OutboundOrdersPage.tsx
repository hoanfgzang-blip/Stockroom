import { useEffect, useRef, useState } from 'react'
import { outboundOrdersApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, Drawer } from '@/components/ui/dialog'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { cn, formatDateTime, statusLabel } from '@/lib/utils'
import type { OutboundOrder, OutboundOrderItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Camera, CheckCircle2, CircleAlert, QrCode, ScanLine } from 'lucide-react'

export default function OutboundOrdersPage() {
  const [orders, setOrders] = useState<OutboundOrder[]>([])
  const [selected, setSelected] = useState<OutboundOrder | null>(null)
  const [items, setItems] = useState<OutboundOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)

    const [cameraOpen, setCameraOpen] = useState(false)
    const [cameraError, setCameraError] = useState('')
    const videoRef = useRef<HTMLVideoElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    outboundOrdersApi
      .all()
      .then(setOrders)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const openDetail = async (order: OutboundOrder) => {
    setSelected(order)
    try {
      const data = await outboundOrdersApi.withItems(order.outboundOrderId)
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
        title="Outbound Orders"
        description="Dispatch orders with inventory reservation linkage."
        action={
          <Button onClick={() => setQrDialogOpen(true)} variant="secondary">
            <QrCode className="h-4 w-4 mr-1.5" />
            Quét QR Outbound
          </Button>
        }
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
                <TableHead>Khách hàng</TableHead>
                <TableHead>Điểm đến</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời điểm tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.outboundOrderId}
                  className={cn('cursor-pointer', selected?.outboundOrderId === order.outboundOrderId && 'bg-violet-50')}
                  onClick={() => openDetail(order)}
                >
                  <TableCell className="font-medium">{order.outboundOrderNumber}</TableCell>
                  <TableCell>{order.outboundCustomerName}</TableCell>
                  <TableCell>{order.outboundDestination}</TableCell>
                  <TableCell>
                    <Badge status={order.status}>{statusLabel(order.status)}</Badge>
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
        title={selected ? `Outbound ${selected.outboundOrderNumber}` : 'Chi tiết đơn hàng'}
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Khách hàng</p>
                <p className="font-medium">{selected.outboundCustomerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Điểm đến</p>
                <p className="font-medium">{selected.outboundDestination}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Trạng thái</p>
                <Badge status={selected.status}>{statusLabel(selected.status)}</Badge>
              </div>
            </div>
            <div>
              <h3 className="mb-3 font-semibold">Reserved Sacks / Items</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">No items linked to this order.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã hàng</TableHead>
                      <TableHead>Mã bao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.outboundOrderItemId}>
                        <TableCell className="font-mono text-xs">{item.outboundOrderItemId}</TableCell>
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

      {/* modal dialog quét qr outbound */}
      <Dialog
        open={qrDialogOpen}
        onClose={() => setQrDialogOpen(false)}
        title="Quét QR Outbound"
        description="Quét mã QR để truy xuất thông tin đơn hàng outbound."
        className="max-w-xl"
      >
        <div className="space-y-4">
          {/* form quet / nhap ma vach */}
        </div>
        
      </Dialog>
    </div>
  )
}
