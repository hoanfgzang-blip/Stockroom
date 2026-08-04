import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Sinh ID tạm thời theo đúng format backend: PREFIX-yyyyMMddHHmmssfff-XXXX
 *  Ví dụ: EMP-20260804182523456-A1B2, PLT-20260804182523456-C3D4
 *  ID này sẽ được gửi lên server (không phải chỉ để hiển thị).
 */
export function generatePreviewId(prefix: string, maxLen = 50): string {
  const now = new Date()
  const p = (n: number, d: number) => String(n).padStart(d, '0')
  const ts =
    `${now.getFullYear()}` +
    `${p(now.getMonth() + 1, 2)}` +
    `${p(now.getDate(), 2)}` +
    `${p(now.getHours(), 2)}` +
    `${p(now.getMinutes(), 2)}` +
    `${p(now.getSeconds(), 2)}` +
    `${p(now.getMilliseconds(), 3)}`
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase()
  return `${prefix}-${ts}-${rand}`.slice(0, maxLen)
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
  if (['completedwithmissing'].includes(s)) return 'danger'
  if (['completed', 'active', 'available', 'intransit', 'inprogress', 'fulfilled', 'arrived', 'loaded'].includes(s))
    return 'success'
  if (['loading', 'pending', 'processing', 'reserved', 'sorting', 'scheduled'].includes(s)) return 'warning'
  if (['cancelled', 'expired', 'inactive', 'full', 'locked'].includes(s)) return 'danger'
  return 'neutral'
}

export function tripColumnLabel(status: string): string {
  const map: Record<string, string> = {
    Loading: 'Đang chất hàng',
    Pending: 'Đã lên lịch',
    InProgress: 'Đang vận chuyển',
    CompletedWithMissing: 'Đến thiếu hàng',
    Completed: 'Đã đến',
    Cancelled: 'Đã hủy',
  }
  return map[status] ?? status
}

export const TRIP_COLUMNS = ['Loading', 'Pending', 'InProgress', 'CompletedWithMissing', 'Completed', 'Cancelled'] as const


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
    Loading: 'Đang chất hàng', Pending: 'Chờ xử lý', InProgress: 'Đang xử lý', CompletedWithMissing: 'Đến thiếu hàng', Completed: 'Hoàn thành', Cancelled: 'Đã hủy',
    Active: 'Đang hoạt động', Inactive: 'Ngừng hoạt động', Available: 'Sẵn sàng', Occupied: 'Đang chứa hàng',
    Reserved: 'Đã giữ hàng', Expired: 'Đã hết hạn', Inbound: 'Nhập hàng', Outbound: 'Xuất hàng',
    Processing: 'Đang xử lý', Sorting: 'Đang phân loại', Arrived: 'Đã đến', Fulfilled: 'Đã hoàn tất',
    Empty: 'Trống', Finalized: 'Đã chốt', Locked: 'Đã khóa', Received: 'Đã giao',
    'In Transit to Zone': 'Đang chuyển zone', InTransit: 'Đang vận chuyển', ReadyForOutbound: 'Sẵn sàng xuất kho', Loaded: 'Đã chất lên xe',
    Create: 'Tạo mới', Update: 'Cập nhật', Delete: 'Xóa',
  }
  return map[status] ?? status
}
