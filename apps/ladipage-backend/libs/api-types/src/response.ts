export const RESPONSE_SUCCESS_CODE = 200;

export interface ResOp<T = unknown> {
  code: number;
  message: string;
  data: T;
}