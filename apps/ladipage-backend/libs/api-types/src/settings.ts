export interface WorkspaceSettingsDto {
  name: string;
  logo?: string;
  timezone: string;
  locale?: string;
  description?: string;
}

export interface FacebookIntegrationDto {
  token?: string;
  pageId?: string;
  configured?: boolean;
}

export interface ZaloIntegrationDto {
  token?: string;
  oaId?: string;
  configured?: boolean;
}

export interface IntegrationsSettingsDto {
  facebook?: FacebookIntegrationDto;
  zalo?: ZaloIntegrationDto;
}