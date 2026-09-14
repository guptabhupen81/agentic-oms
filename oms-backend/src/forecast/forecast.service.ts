import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentTaskService } from '../agent-task/agent-task.service';
import Decimal from 'decimal.js';

export interface ForecastFactorInput {
  name: string;
  factorType: string;
  hierarchyNodeId?: string;
  productId?: string;
  upliftPercent: number;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface ForecastLineInput {
  productId: string;
  baseQty: number;
}

export interface RunForecastInput {
  quarterLabel: string;
  growthPercent: number;
  lines: ForecastLineInput[];
}

/**
 * Forecast Agent. Deliberately simple and explainable rather than
 * statistically fancy: base quantity (user-entered, from last complete
 * quarter's actuals) -> scaled by a quarter growth % -> scaled again by any
 * ACTIVE factor (by date range) that matches the product either directly or
 * via its category. Every line records which factors applied and by how
 * much, in plain text, so a reviewer never has to trust an opaque number.
 */
@Injectable()
export class ForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentTaskService: AgentTaskService,
  ) {}

  async createFactor(input: ForecastFactorInput) {
    return this.prisma.forecastFactor.create({
      data: {
        ...input,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      },
    });
  }

  async listFactors() {
    return this.prisma.forecastFactor.findMany({ orderBy: { startDate: 'desc' } });
  }

  async runForecast(input: RunForecastInput) {
    const now = new Date();
    const activeFactors = await this.prisma.forecastFactor.findMany({
      where: { startDate: { lte: now }, endDate: { gte: now } },
    });

    const forecast = await this.prisma.forecast.create({
      data: { quarterLabel: input.quarterLabel, growthPercent: input.growthPercent },
    });

    const lines = [];
    for (const line of input.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) continue;

      const baseQty = new Decimal(line.baseQty);
      const growthAdjustedQty = baseQty.mul(new Decimal(1).plus(new Decimal(input.growthPercent).div(100)));

      const matchingFactors = activeFactors.filter(
        (f: any) => f.productId === product.id || (f.hierarchyNodeId && f.hierarchyNodeId === product.hierarchyNodeId),
      );

      let finalQty = growthAdjustedQty;
      const factorSummaries: string[] = [];
      for (const factor of matchingFactors) {
        finalQty = finalQty.mul(new Decimal(1).plus(new Decimal(factor.upliftPercent.toString()).div(100)));
        factorSummaries.push(`${factor.name} +${factor.upliftPercent.toString()}%`);
      }

      const forecastLine = await this.prisma.forecastLine.create({
        data: {
          forecastId: forecast.id,
          productId: product.id,
          baseQty: baseQty.toFixed(3),
          growthAdjustedQty: growthAdjustedQty.toFixed(3),
          finalQty: finalQty.toFixed(3),
          appliedFactors: factorSummaries.length > 0 ? factorSummaries.join('; ') : 'No factor applied',
        },
      });
      lines.push(forecastLine);
    }

    await this.agentTaskService.logEvent(
      'Forecast Agent',
      'Forecast',
      forecast.id,
      `Computed forecast for ${input.quarterLabel} across ${lines.length} product line(s), growth ${input.growthPercent}%`,
    );

    return this.prisma.forecast.findUnique({
      where: { id: forecast.id },
      include: { lines: { include: { product: true } } },
    });
  }

  async listForecasts() {
    return this.prisma.forecast.findMany({
      orderBy: { createdAt: 'desc' },
      include: { lines: true },
    });
  }

  async findForecastById(id: string) {
    return this.prisma.forecast.findUnique({
      where: { id },
      include: { lines: { include: { product: true } } },
    });
  }
}
