import { Injectable } from '@nestjs/common'

import type { FlowNodeExecutor } from './flow-node-executor'
import { AutomationConditionExecutor } from './executors/condition.executor'
import { AutomationActionExecutor } from './executors/action.executor'
import { AutomationControlExecutor } from './executors/control.executor'
import { AutomationSendMessageExecutor } from './executors/send-message.executor'
import { AutomationSetVariableExecutor } from './executors/set-variable.executor'
import { AutomationWaitForReplyExecutor } from './executors/wait-for-reply.executor'
import { AutomationWaitExecutor } from './executors/wait.executor'
import { AutomationSplitTrafficExecutor } from './executors/split-traffic.executor'

@Injectable()
export class FlowNodeExecutorRegistry {
  private readonly byType = new Map<string, FlowNodeExecutor>()

  constructor(
    send: AutomationSendMessageExecutor,
    action: AutomationActionExecutor,
    splitTraffic: AutomationSplitTrafficExecutor,
    condition: AutomationConditionExecutor,
    setVariable: AutomationSetVariableExecutor,
    wait: AutomationWaitExecutor,
    waitForReply: AutomationWaitForReplyExecutor,
    control: AutomationControlExecutor,
  ) {
    for (const executor of [send, action, splitTraffic, condition, setVariable, wait, waitForReply, control]) {
      for (const type of executor.types) this.byType.set(type.toUpperCase(), executor)
    }
  }

  resolve(type: string): FlowNodeExecutor | undefined {
    return this.byType.get(String(type ?? '').toUpperCase())
  }
}
