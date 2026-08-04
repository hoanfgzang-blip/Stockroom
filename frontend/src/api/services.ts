import { api } from './client'
import type {
  AuditLog,
  Car,
  DashboardSummary,
  Employee,
  InboundOrder,
  InboundOrderItem,
  InventoryReservation,
  Location,
  OutboundOrder,
  OutboundOrderItem,
  Pallet,
  Province,
  Sack,
  Shift,
  Trip,
  TripQrCheckInRequest,
  TripQrCheckInResult,
  TripQrManifest,
  TripQrTokenIssueResponse,
  Zone,
} from '@/types'
import type { AuthUser } from '@/auth/AuthContext'
import { isOperationalHub, isOperationalProvince } from '@/lib/operationalHubs'

export const authApi = {
  login: (data: { username: string; password: string; rememberMe: boolean }) =>
    api.post<AuthUser>('/Auth/login', data),
  me: () => api.get<AuthUser>('/Auth/me'),
  logout: () => api.post<void>('/Auth/logout', {}),
}

export type ManagedAccount = {
  userId: string
  employeeId: string
  employeeName: string
  username: string
  roleName: string
  isActive: boolean
  locationId: string | null
  locationName: string | null
}

export type SaveAccountRequest = {
  employeeId: string
  username: string
  password?: string
  roleName: string
  isActive: boolean
  locationId: string
}

export type PalletAssignmentResult = {
  succeeded: boolean
  message: string
  sackId?: string
  palletId?: string
  zoneId?: string
  assignedSackCount: number
  classification?: 'IntraProvince' | 'InterProvince'
  destinationName?: string | null
  zoneName?: string | null
  processRole?: string | null
  nextHopId?: string | null
  nextHopName?: string | null
}

export const accountsApi = {
  all: (locationId?: string) =>
    api.get<ManagedAccount[]>(`/Auth/accounts${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`),
  create: (data: SaveAccountRequest) => api.post<ManagedAccount>('/Auth/accounts', data),
  update: (id: string, data: SaveAccountRequest) => api.put<ManagedAccount>(`/Auth/accounts/${id}`, data),
  disable: (id: string) => api.delete(`/Auth/accounts/${id}`),
}

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/Dashboard/summary'),
  recentLogs: (count = 10) => api.get<AuditLog[]>(`/Dashboard/recent-audit-logs?count=${count}`),
}

export const provincesApi = {
  all: async () => (await api.get<Province[]>('/Provinces')).filter((province) => isOperationalProvince(province.provinceId)),
  get: (id: string) => api.get<Province>(`/Provinces/${id}`),
  create: (data: Province) => api.post<Province>('/Provinces', data),
  update: (id: string, data: Province) => api.put<void>(`/Provinces/${id}`, data),
  delete: (id: string) => api.delete(`/Provinces/${id}`),
}

export const locationsApi = {
  all: async () => (await api.get<Location[]>('/Locations')).filter((location) => isOperationalHub(location.locationId)),
  get: (id: string) => api.get<Location>(`/Locations/${id}`),
  byProvince: async (provinceId: string) => (await api.get<Location[]>(`/Locations/by-province/${provinceId}`)).filter((location) => isOperationalHub(location.locationId)),
  dispatchDestinations: () => api.get<Location[]>('/Locations/dispatch-destinations'),
  create: (data: Location) => api.post<Location>('/Locations', data),
  update: (id: string, data: Location) => api.put<void>(`/Locations/${id}`, data),
  delete: (id: string) => api.delete(`/Locations/${id}`),
}

export const zonesApi = {
  all: async () => (await api.get<Zone[]>('/Zones')).filter((zone) => isOperationalHub(zone.locationId)),
  get: (id: string) => api.get<Zone>(`/Zones/${id}`),
  byLocation: async (locationId: string) => (await api.get<Zone[]>(`/Zones/by-location/${locationId}`)).filter((zone) => isOperationalHub(zone.locationId)),
  create: (data: Zone) => api.post<Zone>('/Zones', data),
  update: (id: string, data: Zone) => api.put<void>(`/Zones/${id}`, data),
  delete: (id: string) => api.delete(`/Zones/${id}`),
}

export const palletsApi = {
  all: (status?: string) =>
    api.get<Pallet[]>(`/Pallets${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  get: (id: string) => api.get<Pallet>(`/Pallets/${id}`),
  create: (data: Pick<Pallet, 'zoneId'> & { capacity?: number; palletId?: string }) => api.post<Pallet>('/Pallets', data),
  delete: (id: string) => api.delete(`/Pallets/${id}`),
  assignSack: (palletId: string, sackId: string) =>
    api.post<PalletAssignmentResult>(`/Pallets/${palletId}/assign-sack/${sackId}`, {}),
  reassignSack: (palletId: string, sackId: string) =>
    api.post<PalletAssignmentResult>(`/Pallets/${palletId}/reassign-sack/${sackId}`, {}),
  removeSack: (palletId: string, sackId: string) =>
    api.delete<PalletAssignmentResult>(`/Pallets/${palletId}/sacks/${sackId}`),
  moveToZone: (palletId: string, zoneId: string) =>
    api.post<{ message: string }>(`/Pallets/${palletId}/move-to-zone/${zoneId}`, {}),
  finalize: (palletId: string, outboundOrderId: string) =>
    api.post<{ message: string }>(`/Pallets/${palletId}/finalize`, { outboundOrderId }),
}

export const employeesApi = {
  all: (params?: { role?: string; locationId?: string; shiftId?: string }) => {
    const q = new URLSearchParams()
    if (params?.role) q.set('role', params.role)
    if (params?.locationId) q.set('locationId', params.locationId)
    if (params?.shiftId) q.set('shiftId', params.shiftId)
    const qs = q.toString()
    return api.get<Employee[]>(`/Employees${qs ? `?${qs}` : ''}`).then((employees) =>
      employees.filter((employee) => !employee.locationId || isOperationalHub(employee.locationId)),
    )
  },
  get: (id: string) => api.get<Employee>(`/Employees/${id}`),
  create: (data: Employee) => api.post<Employee>('/Employees', data),
  update: (id: string, data: Employee) => api.put<void>(`/Employees/${id}`, data),
  delete: (id: string) => api.delete(`/Employees/${id}`),
}

export const shiftsApi = {
  all: () => api.get<Shift[]>('/Shifts'),
  get: (id: string) => api.get<Shift>(`/Shifts/${id}`),
  create: (data: Shift) => api.post<Shift>('/Shifts', data),
  update: (id: string, data: Shift) => api.put<void>(`/Shifts/${id}`, data),
  delete: (id: string) => api.delete(`/Shifts/${id}`),
}

export const carsApi = {
  all: () => api.get<Car[]>('/Cars'),
  get: (id: string) => api.get<Car>(`/Cars/${id}`),
  create: (data: Car) => api.post<Car>('/Cars', data),
  update: (id: string, data: Car) => api.put<void>(`/Cars/${id}`, data),
  delete: (id: string) => api.delete(`/Cars/${id}`),
}

export type CreateTripRequest = {
  employeeId: string
  carId: string
  origin: string
  destination: string
  type: 'Inbound' | 'Outbound'
  outboundOrderId?: string | null
  sackIds: string[]
}
export type TripCheckInResult = {
  tripId: string
  carId: string
  status: string
  sackCount: number
  zoneId?: string | null
  zoneName?: string | null
}
export type LoadTripSackResult = {
  tripId: string
  sackId: string
  loadedCount: number
}
export type DispatchTripByQrResult = {
  tripId: string
  carId: string
  status: string
  loadedCount: number
}
export type ScanTripSealResult = {
  tripId: string
  status: string
  phase: 'LoadingStarted' | 'Sealed'
  loadedCount: number
  sealedAt?: string | null
}
export type { TripQrCheckInResult } from '@/types'
export type TripQrResolveResult = {
  manifestVersion: number
  manifest: TripQrManifest
}
export type TripPalletsResult = {
  palletCount: number
  pallets: Pallet[]
}
export const tripsApi = {
  all: (status?: string) =>
    api.get<Trip[]>(`/Trips${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  allForDispatch: (status?: string) =>
    api.get<Trip[]>(`/Trips${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  get: (id: string) => api.get<Trip>(`/Trips/${id}`),
  sacks: (id: string) => api.get<Sack[]>(`/Trips/${id}/sacks`),
  pallets: (id: string) => api.get<TripPalletsResult>(`/Trips/${id}/pallets`),
  qrManifest: (id: string) => api.get<TripQrManifest>(`/Trips/${id}/qr-manifest`),
  issueQrToken: (tripId: string) => api.post<TripQrTokenIssueResponse>(`/Trips/${tripId}/qr-token`, {}),
  resolveQr: (qrValue: string) => api.post<TripQrResolveResult>('/Trips/resolve-qr', { qrValue }),
  create: (data: CreateTripRequest) => api.post<Trip>('/Trips', data),
  loadSack: (tripId: string, sackId: string) =>
    api.post<LoadTripSackResult>(`/Trips/${tripId}/load-sack/${sackId}`, {}),
  departByQr: (qrValue: string) =>
    api.post<DispatchTripByQrResult>('/Trips/depart-by-qr', { qrValue }),
  scanSeal: (tripId: string, sealCode: string) =>
    api.post<ScanTripSealResult>(`/Trips/${tripId}/scan-seal`, { sealCode }),
  update: (id: string, data: Trip) => api.put<void>(`/Trips/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/Trips/${id}/status`, status),
  delete: (id: string) => api.delete(`/Trips/${id}`),
  mine: () => api.get<Trip[]>('/Trips/my'),
  mySacks: (id: string) => api.get<Sack[]>(`/Trips/my/${id}/sacks`),
  updateMyStatus: (id: string, status: 'InProgress' | 'Completed') =>
    api.patch(`/Trips/my/${id}/status`, status),
  checkIn: (id: string) => api.post<TripCheckInResult>(`/Trips/${id}/check-in`, {}),
  checkInByQr: (tripId: string, arrivedSackIds: string[]) => {
    const request: TripQrCheckInRequest = { tripId, arrivedSackIds }
    return api.post<TripQrCheckInResult>('/Trips/check-in-by-qr', request)
  },
}

export const inboundOrdersApi = {
  all: (status?: string) =>
    api.get<InboundOrder[]>(`/InboundOrders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  get: (id: string) => api.get<InboundOrder>(`/InboundOrders/${id}`),
  withItems: (id: string) =>
    api.get<{ order: InboundOrder; items: InboundOrderItem[] }>(`/InboundOrders/${id}/items`),
  create: (data: InboundOrder) => api.post<InboundOrder>('/InboundOrders', data),
  updateStatus: (id: string, status: string) => api.patch(`/InboundOrders/${id}/status`, status),
  delete: (id: string) => api.delete(`/InboundOrders/${id}`),
}

export const outboundOrdersApi = {
  all: (status?: string) =>
    api.get<OutboundOrder[]>(`/OutboundOrders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  allForDispatch: (status?: string) =>
    api.get<OutboundOrder[]>(`/OutboundOrders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  get: (id: string) => api.get<OutboundOrder>(`/OutboundOrders/${id}`),
  withItems: (id: string) =>
    api.get<{ order: OutboundOrder; items: OutboundOrderItem[] }>(`/OutboundOrders/${id}/items`),
  create: (data: OutboundOrder) => api.post<OutboundOrder>('/OutboundOrders', data),
  updateStatus: (id: string, status: string) => api.patch(`/OutboundOrders/${id}/status`, status),
  reserveSack: (id: string, sackId: string, reservationHours = 12) =>
    api.post<InventoryReservation>(`/OutboundOrders/${id}/reserve-sack`, { sackId, reservationHours }),
  delete: (id: string) => api.delete(`/OutboundOrders/${id}`),
}

export const sacksApi = {
  all: (status?: string) =>
    api.get<Sack[]>(`/Sacks${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  get: (id: string) => api.get<Sack>(`/Sacks/${id}`),
  byPallet: (palletId: string) => api.get<Sack[]>(`/Sacks/by-pallet/${palletId}`),
  create: (data: Pick<Sack, 'sDestination'> & Partial<Pick<Sack, 'zoneId' | 'palletId'>>) =>
    api.post<Sack>('/Sacks', data),
  confirmReceived: (id: string) => api.post<void>(`/Sacks/${id}/confirm-received`, {}),
  delete: (id: string) => api.delete(`/Sacks/${id}`),
}

export const reservationsApi = {
  all: (status?: string) =>
    api.get<InventoryReservation[]>(
      `/InventoryReservations${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),
  expired: () => api.get<InventoryReservation[]>('/InventoryReservations/expired'),
  updateStatus: (id: string, status: string) =>
    api.patch(`/InventoryReservations/${id}/status`, status),
  release: (id: string) => api.delete(`/InventoryReservations/${id}`),
}

export const auditLogsApi = {
  all: (params?: { tableName?: string; actionType?: string; userName?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.tableName) q.set('tableName', params.tableName)
    if (params?.actionType) q.set('actionType', params.actionType)
    if (params?.userName) q.set('userName', params.userName)
    if (params?.page) q.set('page', String(params.page))
    const qs = q.toString()
    return api.get<AuditLog[]>(`/AuditLogs${qs ? `?${qs}` : ''}`)
  },
  get: (id: number) => api.get<AuditLog>(`/AuditLogs/${id}`),
}

