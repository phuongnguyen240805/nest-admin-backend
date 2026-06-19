export interface LoginToken {
  token: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  captchaId: string;
  verifyCode: string;
}

export interface ImageCaptcha {
  img: string;
  id: string;
}

export type AuthMode = "legacy" | "supabase";

export interface SupabaseExchangePayload {
  supabaseAccessToken: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  lang: string;
}

export interface RegisterResponse {
  message?: string;
}