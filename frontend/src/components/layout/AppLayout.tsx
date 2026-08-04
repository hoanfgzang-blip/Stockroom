import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  ScanLine,
  Shield,
  Timer,
  Truck,
  UserCog,
  Users,
  Warehouse,
  X,
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
      { to: '/infrastructure/zones', label: 'Zone', icon: Warehouse, roles: ['Manager'] },
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

export function SidebarContent({
  collapsed,
  onToggle,
  onItemClick,
  isMobile,
}: {
  collapsed: boolean
  onToggle?: () => void
  onItemClick?: () => void
  isMobile?: boolean
}) {
  const { user } = useAuth()
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(user!.roleName)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200 select-none overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-slate-800/80 transition-all duration-200',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-600/30 hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Mở rộng menu"
            aria-label="Mở rộng menu"
          >
            <Warehouse className="h-5 w-5 text-white" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-600/30">
                <Warehouse className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1 transition-opacity duration-200">
                <p className="truncate text-sm font-bold tracking-tight text-white">WMS Console</p>
                <p className="truncate text-[11px] font-medium text-slate-400">Bảng điều khiển logistics</p>
              </div>
            </div>

            {isMobile ? (
              <button
                type="button"
                onClick={onToggle}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Đóng menu"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </button>
            ) : (
              onToggle && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title="Thu gọn menu"
                  aria-label="Thu gọn menu"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Sidebar navigation"
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden transition-all duration-200',
          collapsed ? 'px-2' : 'px-3',
        )}
      >
        {visibleGroups.map((group) => (
          <div key={group.label} className={cn('mb-5', collapsed && 'mb-3')}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to} className="relative group/item">
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onItemClick}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                        collapsed
                          ? 'h-10 w-10 mx-auto justify-center'
                          : 'gap-3 px-3 py-2.5',
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                          : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100',
                      )
                    }
                  >
                    <item.icon className={cn('h-5 w-5 shrink-0 transition-transform duration-150', !collapsed && 'h-4 w-4')} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && (
                      <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover/item:opacity-70" />
                    )}
                  </NavLink>

                  {/* Tooltip for collapsed sidebar */}
                  {collapsed && (
                    <div
                      role="tooltip"
                      className="absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 whitespace-nowrap opacity-0 shadow-xl border border-slate-700/80 transition-all duration-150 pointer-events-none group-hover/item:opacity-100 group-hover/item:translate-x-0 z-50"
                    >
                      {item.label}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed ? (
        <div className="shrink-0 border-t border-slate-800/80 p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-800/60 px-3 py-2.5 text-xs font-medium text-slate-400">
            <ClipboardList className="h-4 w-4 shrink-0 text-blue-400" />
            <span className="truncate">WMS Doanh nghiệp v1.0</span>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-slate-800/80 p-2 flex justify-center">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="WMS Doanh nghiệp v1.0"
          >
            <ClipboardList className="h-4 w-4 text-blue-400" />
          </div>
        </div>
      )}
    </div>
  )
}

export function Topbar({ onOpenMobile }: { onOpenMobile?: () => void }) {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-6 backdrop-blur transition-all duration-200">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        {onOpenMobile && (
          <button
            type="button"
            onClick={onOpenMobile}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Mở danh mục menu"
            title="Mở danh mục menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div>
          <p className="text-xs text-slate-500 font-medium">Trung tâm vận hành</p>
          <p className="text-sm font-semibold text-slate-800">Mạng lưới trung chuyển</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm md:flex">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-500">Ca làm việc:</span>
          <select className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer">
            <option>Ca sáng (06:00–14:00)</option>
            <option>Ca chiều (14:00–22:00)</option>
            <option>Ca đêm (22:00–06:00)</option>
          </select>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-1.5 bg-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
            OP
          </div>
          <div className="hidden text-sm sm:block">
            <p className="text-xs font-bold text-slate-800">{user?.employeeName}</p>
            <p className="text-[11px] font-medium text-slate-500">{user?.roleName ? roleLabel(user.roleName) : null}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wms_sidebar_collapsed')
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })

  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('wms_sidebar_collapsed', JSON.stringify(next))
      } catch {
        // ignore localStorage errors
      }
      return next
    })
  }

  // Close mobile drawer on resize to larger screen
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 antialiased">
      {/* Desktop Fixed Sidebar */}
      <aside
        className={cn(
          'hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:flex-col border-r border-slate-800 transition-[width] duration-200 ease-in-out',
          sidebarCollapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <SidebarContent collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </aside>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-200 ease-in-out md:hidden shadow-2xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent
          collapsed={false}
          isMobile
          onToggle={() => setMobileOpen(false)}
          onItemClick={() => setMobileOpen(false)}
        />
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          'min-h-screen flex flex-col transition-[padding-left] duration-200 ease-in-out',
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-64',
        )}
      >
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
