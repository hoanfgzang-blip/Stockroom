import { useEffect, useState } from 'react'
import { auditLogsApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { JsonViewer } from '@/components/shared/JsonViewer'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { formatDateTime, statusLabel } from '@/lib/utils'
import type { AuditLog } from '@/types'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [tableFilter, setTableFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    auditLogsApi
      .all({
        tableName: tableFilter || undefined,
        actionType: actionFilter || undefined,
      })
      .then(setLogs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [tableFilter, actionFilter])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Nhật ký hệ thống"
        description="Nhật ký chỉ đọc để theo dõi thao tác trong hệ thống."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap gap-4 p-4">
          <div className="min-w-[180px]">
            <Label>Tên bảng dữ liệu</Label>
            <Input
              placeholder="Ví dụ: sack"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
            />
          </div>
          <div className="min-w-[180px]">
            <Label>Loại thao tác</Label>
            <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">Tất cả thao tác</option>
              <option value="Create">Tạo mới</option>
              <option value="Update">Cập nhật</option>
              <option value="Delete">Xóa</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nhật ký thao tác ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân viên vận hành</TableHead>
                <TableHead>Thao tác</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Bản ghi</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Dữ liệu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.auditLogId}>
                  <TableCell className="font-medium">{log.userName}</TableCell>
                  <TableCell>
                    <Badge status={log.actionType}>{statusLabel(log.actionType)}</Badge>
                  </TableCell>
                  <TableCell>{log.tableName}</TableCell>
                  <TableCell className="font-mono text-xs">{log.recordId}</TableCell>
                  <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>
                    <JsonViewer oldValues={log.oldValues} newValues={log.newValues} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
