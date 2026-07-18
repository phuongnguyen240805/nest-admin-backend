import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common'

import {
  getCustomDomainCnameTarget,
  isCloudflareSaasConfigured,
  isCustomDomainEdgeEnabled,
  isValidCustomerHostname,
  mapCloudflareHostnameToDomainStatus,
  mapCloudflareSslToStatus,
  normalizeCustomerHostname,
} from './cloudflare-saas.util'

export type CustomHostnameRecord = {
  id: string
  hostname: string
  status: string
  sslStatus: string | null
  domainStatus: ReturnType<typeof mapCloudflareHostnameToDomainStatus>
  mappedSslStatus: ReturnType<typeof mapCloudflareSslToStatus>
  verificationErrors: unknown[]
  raw?: unknown
  cnameTarget: string
  edgeEnabled: boolean
  saasConfigured: boolean
  localStub: boolean
}

/**
 * Nest control-plane for Cloudflare Custom Hostnames (structure.md / Plan P1).
 * Without CLOUDFLARE_* credentials → local-pending stub (safe for free-domain / local test).
 */
@Injectable()
export class CloudflareSaasService {
  createCustomHostname(hostnameRaw: string): Promise<CustomHostnameRecord> {
    const hostname = normalizeCustomerHostname(hostnameRaw)
    if (!hostname || !isValidCustomerHostname(hostname)) {
      throw new BadRequestException(
        'Invalid domain hostname. Use e.g. shop.example.com or www.shop.example.com',
      )
    }

    const cnameTarget = getCustomDomainCnameTarget()
    const edgeEnabled = isCustomDomainEdgeEnabled()
    const saasConfigured = isCloudflareSaasConfigured()

    if (!saasConfigured) {
      return Promise.resolve({
        id: `local-pending-${hostname.replace(/[^a-z0-9.-]/g, '-')}`,
        hostname,
        status: 'pending',
        sslStatus: 'pending_validation',
        domainStatus: 'PENDING',
        mappedSslStatus: 'PENDING',
        verificationErrors: [
          {
            message: `Cloudflare SaaS not configured. Point CNAME ${hostname} → ${cnameTarget}, then set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN for live verification.`,
          },
        ],
        cnameTarget,
        edgeEnabled,
        saasConfigured: false,
        localStub: true,
      })
    }

    return this.postCreate(hostname, cnameTarget, edgeEnabled)
  }

  async getCustomHostname(customHostnameId: string): Promise<CustomHostnameRecord | null> {
    if (!customHostnameId) return null
    const cnameTarget = getCustomDomainCnameTarget()
    const edgeEnabled = isCustomDomainEdgeEnabled()
    const saasConfigured = isCloudflareSaasConfigured()

    if (!saasConfigured || customHostnameId.startsWith('local-pending-')) {
      return {
        id: customHostnameId,
        hostname: customHostnameId.replace(/^local-pending-/, ''),
        status: 'pending',
        sslStatus: 'pending_validation',
        domainStatus: 'PENDING',
        mappedSslStatus: 'PENDING',
        verificationErrors: [
          {
            message: `Point CNAME to ${cnameTarget} then configure CLOUDFLARE_* for live verification.`,
          },
        ],
        cnameTarget,
        edgeEnabled,
        saasConfigured,
        localStub: true,
      }
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!.trim()
    const token = process.env.CLOUDFLARE_API_TOKEN!.trim()
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/custom_hostnames/${encodeURIComponent(customHostnameId)}`
    const res = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(token),
    })
    if (res.status === 404) return null

    const json = (await res.json()) as {
      success?: boolean
      result?: Record<string, unknown>
      errors?: Array<{ message?: string }>
    }
    if (!res.ok || !json.success || !json.result) {
      const msg =
        json.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
        `Cloudflare get custom hostname failed (${res.status})`
      throw new BadGatewayException(msg)
    }
    return this.parse(json.result, cnameTarget, edgeEnabled, false)
  }

  async deleteCustomHostname(
    customHostnameId: string,
  ): Promise<{ deleted: boolean; message: string; localStub: boolean }> {
    if (!customHostnameId) {
      return { deleted: false, message: 'No cloudflare_hostname_id', localStub: true }
    }
    if (!isCloudflareSaasConfigured() || customHostnameId.startsWith('local-pending-')) {
      return {
        deleted: true,
        message: 'Local/dev hostname cleared (no CF API call)',
        localStub: true,
      }
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!.trim()
    const token = process.env.CLOUDFLARE_API_TOKEN!.trim()
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/custom_hostnames/${encodeURIComponent(customHostnameId)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.authHeaders(token),
    })
    if (res.status === 404) {
      return { deleted: true, message: 'Already absent on Cloudflare', localStub: false }
    }
    const json = (await res.json()) as {
      success?: boolean
      errors?: Array<{ message?: string }>
    }
    if (!res.ok || !json.success) {
      const msg =
        json.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
        `Cloudflare delete failed (${res.status})`
      throw new BadGatewayException(msg)
    }
    return { deleted: true, message: 'Deleted on Cloudflare', localStub: false }
  }

  getEdgeFlags() {
    return {
      customDomainEdgeEnabled: isCustomDomainEdgeEnabled(),
      freeSubdomainEnabled: process.env.LANDING_FREE_SUBDOMAIN_ENABLED === 'true',
      freeSiteDomain:
        process.env.FREE_SITE_DOMAIN?.trim() ||
        process.env.NEXT_PUBLIC_FREE_SITE_DOMAIN?.trim() ||
        null,
      cnameTarget: getCustomDomainCnameTarget(),
      saasConfigured: isCloudflareSaasConfigured(),
      landingOriginBaseUrl:
        process.env.LANDING_ORIGIN_BASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        null,
    }
  }

  private async postCreate(
    hostname: string,
    cnameTarget: string,
    edgeEnabled: boolean,
  ): Promise<CustomHostnameRecord> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!.trim()
    const token = process.env.CLOUDFLARE_API_TOKEN!.trim()
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/custom_hostnames`
    const body = {
      hostname,
      ssl: {
        method: 'http',
        type: 'dv',
        settings: {
          http2: 'on',
          min_tls_version: '1.2',
          tls_1_3: 'on',
        },
      },
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(token),
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as {
      success?: boolean
      result?: Record<string, unknown>
      errors?: Array<{ message?: string }>
    }
    if (!res.ok || !json.success || !json.result) {
      const msg =
        json.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
        `Cloudflare create custom hostname failed (${res.status})`
      throw new BadGatewayException(msg)
    }
    return this.parse(json.result, cnameTarget, edgeEnabled, false)
  }

  private parse(
    result: Record<string, unknown>,
    cnameTarget: string,
    edgeEnabled: boolean,
    localStub: boolean,
  ): CustomHostnameRecord {
    const ssl = (result.ssl ?? {}) as Record<string, unknown>
    const sslStatus = typeof ssl.status === 'string' ? ssl.status : null
    const status = typeof result.status === 'string' ? result.status : 'pending'
    const verificationErrors = Array.isArray(result.verification_errors)
      ? result.verification_errors
      : Array.isArray(ssl.validation_errors)
        ? ssl.validation_errors
        : []

    return {
      id: String(result.id ?? ''),
      hostname: String(result.hostname ?? ''),
      status,
      sslStatus,
      domainStatus: mapCloudflareHostnameToDomainStatus({
        hostnameStatus: status,
        sslStatus,
      }),
      mappedSslStatus: mapCloudflareSslToStatus(sslStatus),
      verificationErrors,
      raw: result,
      cnameTarget,
      edgeEnabled,
      saasConfigured: !localStub,
      localStub,
    }
  }

  private authHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }
}
