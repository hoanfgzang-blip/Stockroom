export const OPERATIONAL_HUB_IDS = ['DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN'] as const
export const OPERATIONAL_PROVINCE_IDS = ['DEMO-HN', 'DEMO-HCM', 'DEMO-DN'] as const

const operationalHubIds = new Set<string>(OPERATIONAL_HUB_IDS)
const operationalProvinceIds = new Set<string>(OPERATIONAL_PROVINCE_IDS)

export function isOperationalHub(locationId?: string | null) {
  return Boolean(locationId && operationalHubIds.has(locationId))
}

export function isOperationalProvince(provinceId?: string | null) {
  return Boolean(provinceId && operationalProvinceIds.has(provinceId))
}
