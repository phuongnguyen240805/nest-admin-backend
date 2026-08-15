import { Injectable } from '@nestjs/common'

import type { FlowNodeExecutor } from './flow-node-executor'
import { AutomationConditionExecutor } from './executors/condition.executor'
import { AutomationControlExecutor } from './executors/control.executor'
import { AutomationSendMessageExecutor } from './executors/send-message.executor'
import { AutomationSetVariableExecutor } from './executors/set-variable.executor'
import { AutomationWaitForReplyExecutor } from './executors/wait-for-reply.executor'
import { AutomationWaitExecutor } from './executors/wait.executor'

@Injectable()
export class FlowNodeExecutorRegistry {
  private readonly byType = new Map<string, FlowNodeExecutor>()

  constructor(
    send: AutomationSendMessageExecutor,
    condition: AutomationConditionExecutor,
    setVariable: AutomationSetVariableExecutor,
    wait: AutomationWaitExecutor,
    waitForReply: AutomationWaitForReplyExecutor,
    control: AutomationControlExecutor,
  ) {
    for (const executor of [send, condition, setVariable, wait, waitForReply, control]) {
      for (const type of executor.types) this.byType.set(type.toUpperCase(), executor)
    }
  }

  resolve(type: string): FlowNodeExecutor | undefined {
    return this.byType.get(String(type ?? '').toUpperCase())
  }
}
