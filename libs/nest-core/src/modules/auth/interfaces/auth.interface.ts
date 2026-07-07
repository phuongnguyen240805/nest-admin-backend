export interface IAuthUser {
    uid: number
    pv: number
    /** Organization (workspace) UUID from sys_organizations */
    organizationId?: string
    /** Resolved tenant id (tenants.id) */
    tenantId?: number
    /** Active tenant for multi-tenant switching */
    activeTenantId?: number
    /** Application that issued this session (ladipage, nest-admin, …) */
    appCode?: string
    /** 过期时间 */
    exp?: number
    /** 签发时间 */
    iat?: number
    roles?: string[]
    // uid: number
    // username?: string
    // nickname?: string
    // email?: string
    // avatar?: string
    // pv: number
    // roles: string[]
    // permissions: string[]
    // exp?: number
    // [key: string]: any
}

 export interface IBaseResponse<T = any> {
    message: string
    code: number
    data?: T
  }

  export interface IListRespData<T = any> {
    items: T[]
  }