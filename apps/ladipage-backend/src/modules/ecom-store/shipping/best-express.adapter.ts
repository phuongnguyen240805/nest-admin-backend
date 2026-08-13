import { PartnerHttpShippingAdapter } from './partner-http.adapter'
import type { ShippingIntegrationConfig } from './shipping-adapter'

/** BEST Express endpoints are issued per enterprise contract; no public preset is assumed. */
export class BestExpressShippingAdapter extends PartnerHttpShippingAdapter {
  constructor(config: ShippingIntegrationConfig) { super(config, 'best_express', 'BEST Express') }
}
