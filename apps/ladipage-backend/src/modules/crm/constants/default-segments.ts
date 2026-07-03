export const DEFAULT_SEGMENT_DEFINITIONS = [
  { name: 'New Subscribers', alias: 'new-subscribers' },
  { name: 'SMS Subscribers', alias: 'sms-subscribers' },
  { name: 'Email Subscribers', alias: 'email-subscribers' },
  { name: 'Zalo Subscribers', alias: 'zalo-subscribers' },
  { name: 'Facebook Subscribers', alias: 'facebook-subscribers' },
  { name: 'Email Complaint Subscribers', alias: 'email-complaint-subscribers' },
] as const

export const DEFAULT_SEGMENT_NAMES = DEFAULT_SEGMENT_DEFINITIONS.map(
  (segment) => segment.name,
)