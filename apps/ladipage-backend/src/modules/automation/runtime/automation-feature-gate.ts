export function isAutomationEnabled(): boolean {
  return process.env.AUTOMATION_ENABLED === 'true'
}

export function isAutomationRuntimeEnabled(): boolean {
  return isAutomationEnabled() && process.env.AUTOMATION_RUNTIME_ENABLED === 'true'
}

export function isAutomationTriggerEnabled(): boolean {
  return isAutomationRuntimeEnabled() && process.env.AUTOMATION_TRIGGER_ENABLED === 'true'
}


export function isAutomationActionsEnabled(): boolean {
  return isAutomationRuntimeEnabled() && process.env.AUTOMATION_ACTIONS_ENABLED === 'true'
}

export function isAutomationHttpEnabled(): boolean {
  return isAutomationActionsEnabled() && process.env.AUTOMATION_HTTP_ENABLED === 'true'
}

export function isAutomationRichMessageEnabled(): boolean {
  return isAutomationRuntimeEnabled() && process.env.AUTOMATION_RICH_MESSAGE_ENABLED === 'true'
}

export function isAutomationSequenceEnabled(): boolean {
  return isAutomationRuntimeEnabled() && process.env.AUTOMATION_SEQUENCE_ENABLED === 'true'
}

export function isAutomationBroadcastEnabled(): boolean {
  return isAutomationRuntimeEnabled()
    && process.env.AUTOMATION_BROADCAST_ENABLED === 'true'
    && process.env.AUTOMATION_BROADCAST_DRY_RUN === 'false'
}

export function isAutomationTenantAllowed(tenantId: number): boolean {
  const raw = String(process.env.AUTOMATION_ALLOWED_TENANT_IDS ?? '').trim()
  if (!raw) return true
  const allowed = new Set(
    raw.split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0),
  )
  return allowed.has(tenantId)
}
