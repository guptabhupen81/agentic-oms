import { Controller, Get, Query } from '@nestjs/common';
import { AgentTaskService } from './agent-task.service';

@Controller('agent-tasks')
export class AgentTaskController {
  constructor(private readonly agentTaskService: AgentTaskService) {}

  /** Every pending task across every agent — the Approvals inbox reads this directly. */
  @Get()
  listPending() {
    return this.agentTaskService.listPending();
  }

  /** Recent agent decisions/events, for the Agent Trace page. */
  @Get('events')
  listEvents(@Query('limit') limit?: string) {
    return this.agentTaskService.listRecentEvents(limit ? Number(limit) : undefined);
  }
}
