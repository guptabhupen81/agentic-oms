import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { DISTRIBUTOR_SIDE_ROLES } from '../auth/roles.constants';
import { Controller, Get, Query } from '@nestjs/common';
import { AgentTaskService } from './agent-task.service';

@Roles(...DISTRIBUTOR_SIDE_ROLES)
@Controller('agent-tasks')
export class AgentTaskController {
  constructor(private readonly agentTaskService: AgentTaskService) {}

  /** Every pending task across every agent — the Approvals inbox reads this directly. */
  @Get()
  listPending() {
    return this.agentTaskService.listPending();
  }

  /** Recent agent decisions/events, for the Agent Trace page. */
  @Roles(UserRole.MDM_ADMIN)
  @Get('events')
  listEvents(@Query('limit') limit?: string) {
    return this.agentTaskService.listRecentEvents(limit ? Number(limit) : undefined);
  }
}
