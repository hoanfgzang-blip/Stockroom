export const zoneProcessRoleMeta: Record<string, { label: string; description: string }> = {
  General: {
    label: 'Khu chung',
    description: 'Zone chưa được gán luồng A/B/C.',
  },
  InboundReceipt: {
    label: 'Inbound',
    description: 'Khu tiếp nhận hiện hữu, không thuộc thay đổi này.',
  },
  LocalSortBuffer: {
    label: 'Zone A',
    description: 'Quét sack sau inbound để xác định location đích hoặc hub next hop.',
  },
  LocalOutbound: {
    label: 'Zone B',
    description: 'Outbound nội tỉnh theo location phát.',
  },
  InterprovinceOutbound: {
    label: 'Zone C',
    description: 'Khu outbound liên tỉnh, nhận sack đã được phân tuyến từ Zone A.',
  },
}

export function zoneProcessRoleLabel(processRole?: string | null) {
  return zoneProcessRoleMeta[processRole ?? 'General']?.label ?? processRole ?? 'Khu chung'
}

export function zoneProcessRoleDescription(processRole?: string | null) {
  return zoneProcessRoleMeta[processRole ?? 'General']?.description ?? 'Zone chưa được cấu hình luồng vận hành.'
}

export function isDispatchProcessRole(processRole?: string | null) {
  return processRole === 'LocalOutbound' || processRole === 'InterprovinceOutbound'
}
