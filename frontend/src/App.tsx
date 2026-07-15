import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import InfrastructureLocationsPage from '@/pages/InfrastructureLocationsPage'
import InfrastructureZonesPage from '@/pages/InfrastructureZonesPage'
import EmployeesPage from '@/pages/EmployeesPage'
import TripsPage from '@/pages/TripsPage'
import RoutingRulesPage from '@/pages/RoutingRulesPage'
import InboundOrdersPage from '@/pages/InboundOrdersPage'
import OutboundOrdersPage from '@/pages/OutboundOrdersPage'
import SacksPage from '@/pages/SacksPage'
import ReservationsPage from '@/pages/ReservationsPage'
import AuditLogsPage from '@/pages/AuditLogsPage'
import FleetPage from '@/pages/FleetPage'
import ShiftsPage from '@/pages/ShiftsPage'
import PalletsPage from '@/pages/PalletsPage'
import BarcodeScannerPage from '@/pages/BarcodeScannerPage'
import LoginPage from '@/pages/LoginPage'
import { useAuth } from '@/auth/AuthContext'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Đang kiểm tra phiên đăng nhập...</div>
  if (!user) return <LoginPage />

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/infrastructure/provinces" element={<Navigate to="/infrastructure/locations" replace />} />
        <Route path="/infrastructure/locations" element={<InfrastructureLocationsPage />} />
        <Route path="/infrastructure/zones" element={<InfrastructureZonesPage />} />
        <Route path="/infrastructure/pallets" element={<PalletsPage />} />
        <Route path="/inventory/inbound" element={<InboundOrdersPage />} />
        <Route path="/inventory/outbound" element={<OutboundOrdersPage />} />
        <Route path="/inventory/sacks" element={<SacksPage />} />
        <Route path="/inventory/reservations" element={<ReservationsPage />} />
        <Route path="/operations/barcode-scanner" element={<BarcodeScannerPage />} />
        <Route path="/logistics/fleet" element={<FleetPage />} />
        <Route path="/logistics/trips" element={<TripsPage />} />
        <Route path="/logistics/routing" element={<RoutingRulesPage />} />
        <Route path="/hr/employees" element={<EmployeesPage />} />
        <Route path="/hr/shifts" element={<ShiftsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}
