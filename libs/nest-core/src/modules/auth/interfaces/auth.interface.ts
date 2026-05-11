export interface IAuthUser {
    uid: number
    pv: number
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