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
  MapPin,
  Package,
  ScanLine,
  Route,
  Shield,
  Timer,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/infrastructure/provinces', label: 'Provinces', icon: MapPin },
      { to: '/infrastructure/locations', label: 'Locations / Hubs', icon: Building2 },
      { to: '/infrastructure/zones', label: 'Warehouse Zones', icon: Warehouse },
      { to: '/infrastructure/pallets', label: 'Pallet Management', icon: Package },
    ],
  },
  {
    label: 'Inventory & Orders',
    items: [
      { to: '/operations/barcode-scanner', label: 'Quét mã vạch', icon: ScanLine },
      { to: '/inventory/inbound', label: 'Inbound Orders', icon: ArrowDownToLine },
      { to: '/inventory/outbound', label: 'Outbound Orders', icon: ArrowUpFromLine },
      { to: '/inventory/sacks', label: 'Sack / Bundle', icon: Package },
      { to: '/inventory/reservations', label: 'Inventory Reservations', icon: Timer },
    ],
  },
  {
    label: 'Logistics & Dispatch',
    items: [
      { to: '/logistics/fleet', label: 'Fleet Management', icon: Truck },
      { to: '/logistics/trips', label: 'Trip Scheduling', icon: Route },
      { to: '/logistics/routing', label: 'Routing Rules', icon: Route },
    ],
  },
  {
    label: 'Human Resources',
    items: [
      { to: '/hr/employees', label: 'Employee Directory', icon: Users },
      { to: '/hr/shifts', label: 'Shift Planning', icon: Calendar },
    ],
  },
  {
    label: 'System Security',
    items: [{ to: '/audit-logs', label: 'Audit Logs', icon: Shield }],
  },
]

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Warehouse className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold">WMS Console</p>
          <p className="text-xs text-slate-400">Logistics Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {navGroups.map((group) => (
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
          <span>Enterprise WMS v1.0</span>
        </div>
      </div>
    </aside>
  )
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-6 backdrop-blur">
      <div>
        <p className="text-sm text-slate-500">Operations Center</p>
        <p className="text-sm font-semibold">Cross-docking Network</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-sm md:flex">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-slate-600">Shift:</span>
          <select className="bg-transparent text-sm font-medium outline-none">
            <option>Morning (06:00–14:00)</option>
            <option>Afternoon (14:00–22:00)</option>
            <option>Night (22:00–06:00)</option>
          </select>
        </div>

        <button
          type="button"
          className="relative rounded-lg border p-2 text-slate-500 hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-3 rounded-lg border px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            OP
          </div>
          <div className="hidden text-sm sm:block">
            <p className="font-medium">Ops Manager</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="pl-64">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
