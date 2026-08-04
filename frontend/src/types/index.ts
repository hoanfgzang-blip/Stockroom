export interface Province {
  provinceId: string
  provinceName: string
}

export interface Location {
  locationId: string
  provinceId: string
  locationType: string
  locationName: string
  province?: Province
}

export interface Zone {
  zoneId: string
  locationId: string
  zoneName: string
  zoneType: string
  processRole: string
  capacity: number
  location?: Location
}

export interface Pallet {
  palletId: string
  zoneId: string
  destinationLocationId?: string | null
  status: string
  capacity: number
  zone?: Zone
}

export interface Shift {
  shiftId: string
  shiftName: string
  startAt: string
  endAt: string
}

export interface Employee {
  employeeId: string
  employeeName: string
  roleName: string
  locationId?: string | null
  zoneId?: string | null
  shiftId: string
  location?: Location
  zone?: Zone
  shift?: Shift
}

export interface Car {
  carId: string
  carType: string
  capacity: number
}

export interface Trip {
  tripId: string
  employeeId: string
  carId: string
  origin: string
  destination: string
  outboundOrderId?: string | null
  type: string
  status: string
  createdAt: string
  updatedAt?: string | null
  sackCount?: number
  sealCode?: string | null
  sealedAt?: string | null
  sealedBy?: string | null
  employee?: Employee
  car?: Car
}

export interface TripQrParty {
  id: string
  name: string
}

export interface TripQrVehicle {
  id: string
  type: string
  capacity: number
}

export interface TripQrSack {
  sackId: string
  status: string
  destination: string
  palletId?: string | null
  zoneId?: string | null
}

export interface TripQrManifest {
  tripId: string
  sacks: string[]
  outboundOrderId?: string | null
  outboundOrderNumber?: string | null
  outboundCustomerName?: string | null
  outboundDestination?: string | null
  outboundOrderStatus?: string | null
  outboundSackIds?: string[]
}

export interface TripQrCheckInRequest {
  tripId: string
  qrValue: string
  arrivedSackIds: string[]
}

export interface TripQrCheckInResult {
  tripId: string
  carId: string
  status: string
  expectedCount: number
  arrivedCount: number
  receivedCount: number
  missingSackIds: string[]
  unexpectedSackIds: string[]
  zoneId?: string | null
  zoneName?: string | null
}

export interface TripQrTokenIssueResponse {
  tripId: string
  qrValue: string
  issuedAt: string
  expiresAt: string
  manifestVersion: number
  status: string
  driverName: string
  carInfo: string
  originName: string
  destinationName: string
  sackCount: number
  outboundOrderId?: string | null
  outboundOrderNumber?: string | null
  outboundCustomerName?: string | null
  outboundDestination?: string | null
  outboundOrderStatus?: string | null
}

export interface InboundOrder {
  inboundOrderId: string
  inboundOrderNumber: string
  inboundSuplierName: string
  status: string
  createAt: string
}

export interface InboundOrderItem {
  inboundOrderItemId: string
  inboundOrderId: string
  sackId: string
}

export interface OutboundOrder {
  outboundOrderId: string
  outboundOrderNumber: string
  outboundCustomerName: string
  outboundDestination: string
  originLocationId?: string | null
  status: string
  createAt: string
}

export interface OutboundOrderItem {
  outboundOrderItemId: string
  outboundOrderId: string
  sackId: string
}

export interface Sack {
  sackId: string
  tripId?: string | null
  palletId?: string | null
  status: string
  createdAt: string
  endAt?: string | null
  zoneId?: string | null
  sDestination: string
  nextHopId?: string | null
  trip?: Trip
  pallet?: Pallet
  zone?: Zone
  destinationLocation?: Location
  nextHopLocation?: Location
}

export interface InventoryReservation {
  reservationId: string
  outboundOrderId: string
  sackId: string
  reservedAt: string
  expiresAt: string
  status: string
  outboundOrder?: OutboundOrder
  sack?: Sack
}

export interface AuditLog {
  auditLogId: number
  userId: string
  userName?: string | null
  actionType: string
  tableName: string
  recordId: string
  oldValues?: string | null
  newValues?: string | null
  createdAt: string
}

export interface DashboardSummary {
  totalSacks: number
  sortingSacks: number
  totalInbound: number
  pendingInbound: number
  totalOutbound: number
  totalTrips: number
  activeTrips: number
  totalPallets: number
  totalLocations: number
  totalZones: number
  totalEmployees: number
  recentLogs: AuditLog[]
}
