import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentTaskStatus, AgentTaskType } from '@prisma/client';

export interface CreateAgentTaskInput {
  taskType: AgentTaskType;
  entityType: string;
  entityId: string;
  reasonNote: string;
  dueAt: Date;
}

/**
 * Generic approval-queue + audit-trail service. Deliberately knows nothing
 * about Orders, Purchase Orders, or any other specific entity — each
 * domain service (OrderService, PurchaseService, ...) creates tasks here
 * and owns its OWN resolution endpoint (e.g. POST /orders/:id/resolve-
 * validation), which then calls markResolved() below. This keeps the
 * dependency graph one-directional (domain modules depend on this one,
 * never the reverse) instead of reaching for circular module imports.
 */
@Injectable()
export class AgentTaskService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAgentTaskInput) {
    const task = await this.prisma.agentTask.create({ data: input });
    await this.logEvent(
      this.agentNameForTaskType(input.taskType),
      input.entityType,
      input.entityId,
      `Opened ${input.taskType} task: ${input.reasonNote}`,
    );
    return task;
  }

  async listPending() {
    return this.prisma.agentTask.findMany({
      where: { status: AgentTaskStatus.PENDING },
      orderBy: { dueAt: 'asc' },
    });
  }

  async findPending(entityType: string, entityId: string, taskType: AgentTaskType) {
    return this.prisma.agentTask.findFirst({
      where: { entityType, entityId, taskType, status: AgentTaskStatus.PENDING },
    });
  }

  async markResolved(taskId: string, status: AgentTaskStatus, userId: string) {
    const task = await this.prisma.agentTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Agent task not found');

    const updated = await this.prisma.agentTask.update({
      where: { id: taskId },
      data: { status, resolvedAt: new Date(), resolvedById: userId },
    });

    await this.logEvent(
      this.agentNameForTaskType(task.taskType),
      task.entityType,
      task.entityId,
      `Task ${status === AgentTaskStatus.APPROVED ? 'approved' : 'rejected'} by user ${userId}`,
    );

    return updated;
  }

  async logEvent(agentName: string, entityType: string, entityId: string, message: string) {
    return this.prisma.agentEvent.create({ data: { agentName, entityType, entityId, message } });
  }

  async listRecentEvents(limit = 50) {
    return this.prisma.agentEvent.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  private agentNameForTaskType(taskType: AgentTaskType): string {
    switch (taskType) {
      case AgentTaskType.ORDER_VALIDATION:
        return 'Order Agent';
      case AgentTaskType.PO_HOLD:
        return 'Demand Agent';
      case AgentTaskType.COST_APPROVAL:
        return 'Fulfilment Agent';
      case AgentTaskType.DELIVERY_DISPUTE:
        return 'Fulfilment Agent';
      case AgentTaskType.BREAKDOWN_WATCHDOG:
        return 'Fleet Agent';
      default:
        return 'Agent';
    }
  }
}
