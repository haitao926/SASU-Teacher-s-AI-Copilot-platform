export function getTenantId(headers: Record<string, any>): string {
  const tenantFromHeader = headers['x-tenant-id']
  if (typeof tenantFromHeader === 'string' && tenantFromHeader.trim().length > 0) {
    return tenantFromHeader.trim()
  }
  return 'default'
}
