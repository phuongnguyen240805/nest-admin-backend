export const PUBLISH_QUEUE = 'landing-publish'
export const PUBLISH_JOB_NAME = 'publish-landing-page'
export const PUBLISH_MAX_ATTEMPTS = 3

export interface LandingPublishQueuePayload {
  jobId: string
}
