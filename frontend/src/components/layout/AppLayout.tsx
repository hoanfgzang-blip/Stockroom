import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScanLine,
  Route,
  Shield,
  Timer,
  Truck,
  Users,
  UserCog,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { roleLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

type NavItem = { to: string; label: string; icon: LucideIcon; roles?: string[] }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Tổng quan',
    items: [{ to: '/', label: 'Bảng điều khiển', icon: LayoutDashboard, roles: ['Manager', 'Supervisor', 'WarehouseStaff', 'Operator'] }],
  },
  {
    label: 'Công việc',
    items: [{ to: '/driver/deliveries', label: 'Giao hàng của tôi', icon: Truck, roles: ['Tài xế'] }],
  },
  {
    label: 'Hạ tầng',
    items: [
      { to: '/infrastructure/locations', label: 'Địa điểm / Hub', icon: Building2, roles: ['Manager'] },
      { to: '/infrastructure/zones', label: 'Khu vực kho', icon: Warehouse, roles: ['Manager'] },
      { to: '/infrastructure/pallets', label: 'Quản lý pallet', icon: Package, roles: ['Manager', 'Supervisor', 'WarehouseStaff', 'Operator'] },
    ],
  },
  {
    label: 'Hàng hóa và đơn hàng',
    items: [
      { to: '/operations/barcode-scanner', label: 'Quét mã vạch', icon: ScanLine, roles: ['Manager', 'Supervisor', 'WarehouseStaff', 'Operator'] },
      { to: '/inventory/inbound', label: 'Đơn nhập kho', icon: ArrowDownToLine, roles: ['Manager', 'Supervisor', 'WarehouseStaff', 'Operator'] },
      { to: '/inventory/outbound', label: 'Đơn xuất kho', icon: ArrowUpFromLine, roles: ['Manager', 'Supervisor', 'WarehouseStaff', 'Operator'] },
      { to: '/inventory/sacks', label: 'Bao hàng', icon: Package, roles: ['Manager', 'Supervisor', 'WarehouseStaff', 'Operator'] },
      { to: '/inventory/reservations', label: 'Giữ hàng', icon: Timer, roles: ['Manager', 'Supervisor', 'WarehouseStaff', 'Operator'] },
    ],
  },
  {
    label: 'Vận tải và điều phối',
    items: [
      { to: '/logistics/fleet', label: 'Quản lý phương tiện', icon: Truck, roles: ['Manager', 'Supervisor'] },
      { to: '/logistics/trips', label: 'Điều phối chuyến xe', icon: Route, roles: ['Manager', 'Supervisor'] },
      { to: '/logistics/routing', label: 'Quy tắc định tuyến', icon: Route, roles: ['Manager', 'Supervisor'] },
    ],
  },
  {
    label: 'Nhân sự',
    items: [
      { to: '/hr/employees', label: 'Danh sách nhân viên', icon: Users, roles: ['Manager'] },
      { to: '/hr/shifts', label: 'Quản lý ca làm việc', icon: Calendar, roles: ['Manager'] },
    ],
  },
  {
    label: 'Bảo mật hệ thống',
    items: [
      { to: '/system/accounts', label: 'Quản lý tài khoản', icon: UserCog, roles: ['Manager'] },
      { to: '/audit-logs', label: 'Nhật ký hệ thống', icon: Shield, roles: ['Manager'] },
    ],
  },
]

export function Sidebar({ isOpen }: { isOpen: boolean }) {
  const { user } = useAuth()
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || item.roles.includes(user!.roleName)) }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Warehouse className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold">WMS Console</p>
          <p className="text-xs text-slate-400">Bảng điều khiển logistics</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-slate-300 hover:bg-sidebar-accent hover:text-white',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2 text-xs text-slate-300">
          <ClipboardList className="h-4 w-4" />
          <span>WMS Doanh nghiệp v1.0</span>
        </div>
      </div>
    </aside>
  )
}

export function Topbar({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Toggle Sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm text-slate-500">Trung tâm vận hành</p>
          <p className="text-sm font-semibold">Mạng lưới trung chuyển</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-sm md:flex">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-slate-600">Ca làm việc:</span>
          <select className="bg-transparent text-sm font-medium outline-none">
            <option>Ca sáng (06:00–14:00)</option>
            <option>Ca chiều (14:00–22:00)</option>
            <option>Ca đêm (22:00–06:00)</option>
          </select>
        </div>

        <button
          type="button"
          className="relative rounded-lg border p-2 text-slate-500 hover:bg-slate-50"
          aria-label="Thông báo"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-3 rounded-lg border px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            OP
          </div>
          <div className="hidden text-sm sm:block">
            <p className="font-medium">{user?.employeeName}</p>
            <p className="text-xs text-slate-500">{user?.roleName ? roleLabel(user.roleName) : null}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Đăng xuất" aria-label="Đăng xuất">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} />
      <div className={cn("transition-all duration-300", isSidebarOpen ? "pl-64" : "pl-0")}>
        <Topbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
