import axios from 'axios'

import { GhnShippingAdapter } from './ghn.adapter'

jest.mock('axios')

const mockedAxios = axios as jest.Mocked<typeof axios>

describe('GhnShippingAdapter location catalog', () => {
  const adapter = new GhnShippingAdapter({
    id: 1,
    provider: 'ghn',
    enabled: true,
    credentials: { token: 'token', shopId: '100' },
    settings: { environment: 'sandbox', fromDistrictId: 1442 },
  })

  beforeEach(() => jest.clearAllMocks())

  it('returns only active merged wards, deduplicated and sorted', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: [
          { WardCode: '03', WardName: 'Phường C', Status: 2 },
          { WardCode: '02', WardName: 'Phường B', Status: 1 },
          { WardCode: '01', WardName: 'Phường A', Status: 1 },
          { WardCode: '01', WardName: 'Phường A', Status: 1 },
        ],
      },
    })

    await expect(adapter.execute('getWards', { districtId: 1442 })).resolves.toEqual({
      wards: [
        { WardCode: '01', WardName: 'Phường A', Status: 1 },
        { WardCode: '02', WardName: 'Phường B', Status: 1 },
      ],
    })
  })

  it('resolves the live pickup district from the configured GHN shop', async () => {
    const invalidAdapter = new GhnShippingAdapter({
      id: 1,
      provider: 'ghn',
      enabled: true,
      credentials: { token: 'token', shopId: '100' },
      settings: {},
    })
    mockedAxios.post
      .mockResolvedValueOnce({ data: { data: { shops: [{ _id: 100, district_id: 1455 }] } } })
      .mockResolvedValueOnce({ data: { data: [{ service_id: 1, service_type_id: 2 }] } })

    await expect(invalidAdapter.execute('getServices', { toDistrict: 1442 }))
      .resolves.toEqual({ services: [{ service_id: 1, service_type_id: 2 }] })
    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      expect.stringContaining('/available-services'),
      expect.objectContaining({ from_district: 1455, to_district: 1442 }),
      expect.any(Object),
    )
  })
})
