import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatTimeSpan(value?: string | null): string {
  if (!value) return '—'
  const parts = value.split(':')
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`
  return value
}

export function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const s = status.toLowerCase().replace(/[\s_-]/g, '')
  if (['completed', 'active', 'available', 'intransit', 'inprogress', 'fulfilled', 'arrived'].includes(s))
    return 'success'
  if (['pending', 'processing', 'reserved', 'sorting', 'scheduled'].includes(s)) return 'warning'
  if (['cancelled', 'expired', 'inactive', 'full', 'locked'].includes(s)) return 'danger'
  return 'neutral'
}

export function tripColumnLabel(status: string): string {
  const map: Record<string, string> = {
    Pending: 'Đã lên lịch',
    InProgress: 'Đang vận chuyển',
    Completed: 'Đã đến',
    Cancelled: 'Đã hủy',
  }
  return map[status] ?? status
}

export const TRIP_COLUMNS = ['Pending', 'InProgress', 'Completed', 'Cancelled'] as const


export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    Manager: 'Quản lý',
    Supervisor: 'Giám sát',
    WarehouseStaff: 'Nhân viên kho',
    Operator: 'Nhân viên vận hành',
    Driver: 'Tài xế',
  }
  return map[role] ?? role
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    Pending: 'Chờ xử lý', InProgress: 'Đang xử lý', Completed: 'Hoàn thành', Cancelled: 'Đã hủy',
    Active: 'Đang hoạt động', Inactive: 'Ngừng hoạt động', Available: 'Sẵn sàng', Occupied: 'Đang chứa hàng',
    Reserved: 'Đã giữ hàng', Expired: 'Đã hết hạn', Inbound: 'Nhập hàng', Outbound: 'Xuất hàng',
    Processing: 'Đang xử lý', Sorting: 'Đang phân loại', Arrived: 'Đã đến', Fulfilled: 'Đã hoàn tất',
    Empty: 'Trống', Finalized: 'Đã chốt', Locked: 'Đã khóa', Received: 'Đã giao',
    'In Transit to Zone': 'Đang chuyển khu vực', InTransit: 'Đang vận chuyển', ReadyForOutbound: 'Sẵn sàng xuất kho',
    Create: 'Tạo mới', Update: 'Cập nhật', Delete: 'Xóa',
  }
  return map[status] ?? status
}
