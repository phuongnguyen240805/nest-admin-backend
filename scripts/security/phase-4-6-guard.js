#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
const failures = []

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function mustContain(relativePath, pattern, message) {
  if (!pattern.test(read(relativePath))) failures.push(`${relativePath}: ${message}`)
}

function mustNotContain(relativePath, pattern, message) {
  if (pattern.test(read(relativePath))) failures.push(`${relativePath}: ${message}`)
}

const tenantScopedPath = 'apps/ladipage-backend/src/common/services/tenant-scoped.service.ts'
const tenantScoped = read(tenantScopedPath)
const spreadPosition = tenantScoped.indexOf('...(extra ?? {})')
const tenantPosition = tenantScoped.indexOf('tenantId: this.requireTenantId()')
if (spreadPosition < 0 || tenantPosition < 0 || tenantPosition < spreadPosition) {
  failures.push(
    `${tenantScopedPath}: authenticated tenantId must be assigned after caller criteria so it cannot be overridden`,
  )
}
mustContain(
  tenantScopedPath,
  /assertTenantOwnedIds/,
  'tenant relation ownership helper is required',
)

const legacyInterceptor = 'libs/nest-core/src/modules/tenant/tenant-context.interceptor.ts'
mustNotContain(
  legacyInterceptor,
  /x-tenant-id|request\.query\?\.tenantId/,
  'legacy tenant context must not derive authority from browser header/query input',
)
mustContain(
  legacyInterceptor,
  /request\.user\?\.activeTenantId\s*\?\?\s*request\.user\?\.tenantId/,
  'legacy tenant context must derive from verified user claims',
)

for (const service of [
  'apps/ladipage-backend/src/modules/crm/services/customer.service.ts',
  'apps/ladipage-backend/src/modules/crm/services/person-relation.service.ts',
  'apps/ladipage-backend/src/modules/ecom-store/services/category.service.ts',
  'apps/ladipage-backend/src/modules/ecom-store/services/delivery-note.service.ts',
  'apps/ladipage-backend/src/modules/ecom-store/services/order.service.ts',
  'apps/ladipage-backend/src/modules/ecom-store/services/product.service.ts',
]) {
  mustContain(
    service,
    /assertTenantOwnedIds/,
    'tenant-owned relation ids must be checked before mapping/write operations',
  )
}

const tagServicePath = 'apps/ladipage-backend/src/modules/ecom-store/services/tag.service.ts'
const tagService = read(tagServicePath)
const removeStart = tagService.indexOf('async remove(')
const removeBody = removeStart >= 0 ? tagService.slice(removeStart) : ''
const firstOwnershipCheck = removeBody.indexOf('findOneForTenantOrFail')
const firstMapDelete = removeBody.indexOf('mapRepo.delete')
if (
  removeStart < 0 ||
  firstOwnershipCheck < 0 ||
  firstMapDelete < 0 ||
  firstOwnershipCheck > firstMapDelete
) {
  failures.push(
    `${tagServicePath}: tag ownership must be checked before deleting relation mappings`,
  )
}

const migrationPath = 'libs/database/src/migrations/1765000000000-tenant-list-query-indexes.ts'
mustContain(
  migrationPath,
  /transaction\s*=\s*false/,
  'concurrent index migration must opt out of transaction',
)
mustContain(
  migrationPath,
  /CREATE INDEX CONCURRENTLY IF NOT EXISTS[\s\S]*IDX_lp_customer_tenant_created_id/,
  'customer tenant/list index is required',
)
mustContain(
  migrationPath,
  /IDX_lp_order_tenant_created_id/,
  'order tenant/list index is required',
)
mustContain(
  migrationPath,
  /IDX_lp_product_tenant_created_id/,
  'product tenant/list index is required',
)

if (failures.length) {
  console.error('Phase 4-6 backend guard failed:\n- ' + failures.join('\n- '))
  process.exit(1)
}

console.log('Phase 4-6 backend guard passed.')
