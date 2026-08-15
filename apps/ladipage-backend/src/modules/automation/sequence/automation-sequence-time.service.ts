import { Injectable } from '@nestjs/common'

import { AutomationSequenceStepEntity } from '../entities'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

@Injectable()
export class AutomationSequenceTimeService {
  calculate(step: AutomationSequenceStepEntity, baseTime: Date, timezone: string): Date {
    if (step.specificDateTime) return new Date(step.specificDateTime)
    const delayed = new Date(
      baseTime.getTime()
      + Math.max(0, step.delayDays) * 86_400_000
      + Math.max(0, step.delayMinutes) * 60_000,
    )
    if (step.anytime) return delayed
    return this.nextAllowed(delayed, timezone, step.sendDays, step.sendTimeStart, step.sendTimeEnd)
  }

  private nextAllowed(base: Date, timezone: string, sendDays: string[], start: string | null, end: string | null): Date {
    const allowed = new Set((sendDays?.length ? sendDays : DAY_NAMES).map((value) => String(value).toLowerCase()))
    const startMin = this.timeMinutes(start, 0)
    const endMin = this.timeMinutes(end, 24 * 60)
    const overnight = endMin < startMin
    let candidate = new Date(base)

    // Scan at most 14 days. We advance in <=30-minute increments so this
    // remains timezone/DST safe without persisting in-process timers.
    for (let attempt = 0; attempt < 14 * 48; attempt += 1) {
      const local = this.parts(candidate, timezone)
      const minuteOfDay = local.hour * 60 + local.minute
      const currentDay = DAY_NAMES[local.weekday]

      if (!overnight) {
        if (allowed.has(currentDay) && minuteOfDay >= startMin && minuteOfDay < endMin) return candidate
        if (allowed.has(currentDay) && minuteOfDay < startMin) {
          candidate = new Date(candidate.getTime() + (startMin - minuteOfDay) * 60_000)
          continue
        }
      } else {
        // For an overnight window (for example 22:00-06:00), the evening
        // belongs to the configured day and the after-midnight portion belongs
        // to the previous configured day.
        const previousDay = DAY_NAMES[(local.weekday + 6) % 7]
        const inEvening = allowed.has(currentDay) && minuteOfDay >= startMin
        const inAfterMidnight = allowed.has(previousDay) && minuteOfDay < endMin
        if (inEvening || inAfterMidnight) return candidate
        if (allowed.has(currentDay) && minuteOfDay < startMin && minuteOfDay >= endMin) {
          candidate = new Date(candidate.getTime() + (startMin - minuteOfDay) * 60_000)
          continue
        }
      }

      candidate = new Date(candidate.getTime() + 30 * 60_000)
    }

    // Fail closed: if no valid slot can be resolved, do not return the original
    // disallowed time. The caller can defer/retry rather than send outside the
    // configured window.
    return candidate
  }

  private parts(date: Date, timezone: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'UTC',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date)
      const weekdayText = parts.find((part) => part.type === 'weekday')?.value?.toLowerCase() ?? 'sun'
      const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(weekdayText.slice(0, 3))
      return {
        weekday: weekday >= 0 ? weekday : 0,
        hour: Number(parts.find((part) => part.type === 'hour')?.value ?? 0),
        minute: Number(parts.find((part) => part.type === 'minute')?.value ?? 0),
      }
    } catch {
      return { weekday: date.getUTCDay(), hour: date.getUTCHours(), minute: date.getUTCMinutes() }
    }
  }

  private timeMinutes(value: string | null, fallback: number): number {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return fallback
    const [hour, minute] = value.split(':').map(Number)
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback
    return hour * 60 + minute
  }
}
