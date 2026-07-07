import {
  createPayOsSignature,
  signPaymentLinkRequest,
  verifyPayOsSignature,
} from './payos-signature.util'

describe('payos-signature.util', () => {
  const checksumKey = '1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675'

  const webhookData = {
    orderCode: 123,
    amount: 3000,
    description: 'VQRIO123',
    accountNumber: '12345678',
    reference: 'TF230204212323',
    transactionDateTime: '2023-02-04 18:25:00',
    currency: 'VND',
    paymentLinkId: '124c33293c43417ab7879e14c8d9eb18',
    code: '00',
    desc: 'Thành công',
    counterAccountBankId: '',
    counterAccountBankName: '',
    counterAccountName: '',
    counterAccountNumber: '',
    virtualAccountName: '',
    virtualAccountNumber: '',
  }

  it('verifies PayOS webhook sample signature from docs', () => {
    const signature = '412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03'
    expect(verifyPayOsSignature(webhookData, signature, checksumKey)).toBe(true)
  })

  it('creates deterministic payment link signature', () => {
    const signature = signPaymentLinkRequest(
      {
        amount: 990000,
        cancelUrl: 'https://example.com/billing?cancelled=1',
        description: 'LadiPage Pro yearly',
        orderCode: 1000000001,
        returnUrl: 'https://example.com/billing/success?orderCode=1000000001',
      },
      checksumKey,
    )

    expect(signature).toHaveLength(64)
    expect(
      createPayOsSignature(
        {
          amount: 990000,
          cancelUrl: 'https://example.com/billing?cancelled=1',
          description: 'LadiPage Pro yearly',
          orderCode: 1000000001,
          returnUrl: 'https://example.com/billing/success?orderCode=1000000001',
        },
        checksumKey,
      ),
    ).toBe(signature)
  })

  it('rejects tampered webhook data', () => {
    const signature = '412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03'
    expect(
      verifyPayOsSignature({ ...webhookData, amount: 9999 }, signature, checksumKey),
    ).toBe(false)
  })
})