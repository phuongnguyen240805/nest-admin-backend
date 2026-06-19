export interface AccountInfo {
  username: string;
  nickname: string;
  email: string;
  phone: string;
  remark: string;
  avatar: string;
}

export interface AccountMenuMeta {
  title?: string;
  icon?: string;
  isHide?: boolean;
  isLink?: string;
  isIframe?: boolean;
  [key: string]: unknown;
}

export interface AccountMenus {
  id: number;
  path: string;
  name: string;
  component: string;
  meta: AccountMenuMeta;
}

export interface AccountUpdatePayload {
  nickname?: string;
  email?: string;
  qq?: string;
  phone?: string;
  avatar?: string;
  remark?: string;
}

export interface PasswordUpdatePayload {
  oldPassword: string;
  newPassword: string;
}