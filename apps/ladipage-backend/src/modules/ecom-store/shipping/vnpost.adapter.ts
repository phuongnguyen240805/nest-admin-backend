import { PartnerHttpShippingAdapter } from './partner-http.adapter'
import type { ShippingIntegrationConfig } from './shipping-adapter'

/** VNPost endpoints are issued per enterprise contract; no public preset is assumed. */
export class VnpostShippingAdapter extends PartnerHttpShippingAdapter {
  constructor(config: ShippingIntegrationConfig) { super(config, 'vnpost', 'VNPost') }
}
