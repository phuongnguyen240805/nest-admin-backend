type ApplicationSeedCatalogItem = {
  code: string
  name: string
  price: number
  statusActive?: boolean
  statusPin?: boolean
  installsCount?: number
}

export const APPLICATION_SEED_CATALOG: ApplicationSeedCatalogItem[] = [
  { code: 'WebsiteBuilder', name: 'Website Builder', price: 0, statusActive: true, statusPin: true, installsCount: 10847 },
  { code: 'Ecommerce', name: 'Ecom Store', price: 0, statusActive: true, statusPin: true, installsCount: 6873 },
  { code: 'Automation', name: 'Dynamic', price: 0, statusActive: false, statusPin: false, installsCount: 2295 },
  { code: 'LadiWork', name: 'LadiWork', price: 0, statusActive: false, statusPin: false, installsCount: 1480 },
  { code: 'ELearning', name: 'E-Learning', price: 0, statusActive: false, statusPin: false, installsCount: 4218 },
  { code: 'FacebookAds', name: 'Facebook Ads', price: 0, statusActive: false, statusPin: false, installsCount: 1520 },
  { code: 'CloudPhone', name: 'CloudPhone', price: 0, statusActive: false, statusPin: false, installsCount: 2048 },
  { code: 'OfferKit', name: 'OfferKit', price: 2_400_000, statusActive: false, statusPin: false, installsCount: 1786 },
  { code: 'AiSeo', name: 'AI SEO', price: 0, statusActive: false, statusPin: false, installsCount: 2150 },
  { code: 'SiteMetrics', name: 'Site Metrics', price: 0, statusActive: false, statusPin: false, installsCount: 1890 },
  { code: 'Local', name: 'Local', price: 800_000, statusActive: false, statusPin: false, installsCount: 1240 },
  { code: 'Content', name: 'Content', price: 1_500_000, statusActive: false, statusPin: false, installsCount: 4120 },
  { code: 'Keywords', name: 'Keywords', price: 0, statusActive: false, statusPin: false, installsCount: 5310 },
  { code: 'Reports', name: 'Reports', price: 0, statusActive: false, statusPin: false, installsCount: 1740 },
  { code: 'Authority', name: 'Authority', price: 0, statusActive: false, statusPin: false, installsCount: 890 },
]
