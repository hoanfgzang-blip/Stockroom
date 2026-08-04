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
    description: 'Chờ chia chọn lần hai cho hàng nội tỉnh.',
  },
  LocalOutbound: {
    label: 'Zone B',
    description: 'Outbound nội tỉnh theo location phát.',
  },
  InterprovinceOutbound: {
    label: 'Zone C',
    description: 'Outbound ngoại tỉnh theo hub next hop.',
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
