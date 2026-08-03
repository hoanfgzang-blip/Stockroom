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
  capacity: number
  location?: Location
}

export interface Pallet {
  palletId: string
  zoneId: string
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
  locationId: string
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
  type: string
  status: string
  createdAt: string
  updatedAt?: string | null
  sackCount?: number
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
  kind: 'WMS_TRIP_MANIFEST'
  version: 1
  tripId: string
  type: string
  status: string
  driver: TripQrParty
  vehicle: TripQrVehicle
  origin: TripQrParty
  destination: TripQrParty
  createdAt: string
  issuedAt: string
  sacks: TripQrSack[]
}

export interface RoutingRule {
  ruleId: string
  currentLocationID: string
  cDestinationID: string
  nextHop: string
  currentLocation?: Location
  cDestination?: Location
  nextHopLocation?: Location
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
  trip?: Trip
  pallet?: Pallet
  zone?: Zone
  destinationLocation?: Location
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
  userName: string
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
