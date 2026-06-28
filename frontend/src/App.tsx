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

export default function App() {
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
