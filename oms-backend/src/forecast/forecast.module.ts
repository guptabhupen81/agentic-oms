import { Module } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { ForecastController, ForecastFactorController } from './forecast.controller';
import { AgentTaskModule } from '../agent-task/agent-task.module';

@Module({
  imports: [AgentTaskModule],
  controllers: [ForecastController, ForecastFactorController],
  providers: [ForecastService],
  exports: [ForecastService],
})
export class ForecastModule {}
