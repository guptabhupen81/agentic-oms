import { Module } from '@nestjs/common';
import { AgentTaskService } from './agent-task.service';
import { AgentTaskController } from './agent-task.controller';

@Module({
  controllers: [AgentTaskController],
  providers: [AgentTaskService],
  exports: [AgentTaskService],
})
export class AgentTaskModule {}
