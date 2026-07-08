import { createHmac } from 'crypto'

type PayOsSignatureData = Record<string, unknown>

function asSignatureData(data: object): PayOsSignatureData {
  return data as PayOsSignatureData
}

function sortObjDataByKey(object: PayOsSignatureData): PayOsSignatureData {
  return Object.keys(object)
    .sort()
    .reduce<PayOsSignatureData>((obj, key) => {
      obj[key] = object[key]
      return obj
    }, {})
}

function convertObjToQueryStr(object: PayOsSignatureData): string {
  return Object.keys(object)
    .filter(key => object[key] !== undefined)
    .map((key) => {
      let value = object[key]

      if (Array.isArray(value)) {
        value = JSON.stringify(
          value.map(item =>
            typeof item === 'object' && item !== null
              ? sortObjDataByKey(item as PayOsSignatureData)
              : item,
          ),
        )
      }

      if ([null, undefined, 'undefined', 'null'].includes(value as string | null | undefined)) {
        value = ''
      }

      return `${key}=${value}`
    })
    .join('&')
}

export function createPayOsSignature(
  data: object,
  checksumKey: string,
): string {
  const sorted = sortObjDataByKey(asSignatureData(data))
  const query = convertObjToQueryStr(sorted)
  return createHmac('sha256', checksumKey).update(query).digest('hex')
}

export function verifyPayOsSignature(
  data: object,
  signature: string,
  checksumKey: string,
): boolean {
  const computed = createPayOsSignature(data, checksumKey)
  return computed === signature
}

export function signPaymentLinkRequest(
  input: {
    amount: number
    cancelUrl: string
    description: string
    orderCode: number
    returnUrl: string
  },
  checksumKey: string,
): string {
  return createPayOsSignature(
    {
      amount: input.amount,
      cancelUrl: input.cancelUrl,
      description: input.description,
      orderCode: input.orderCode,
      returnUrl: input.returnUrl,
    },
    checksumKey,
  )
}