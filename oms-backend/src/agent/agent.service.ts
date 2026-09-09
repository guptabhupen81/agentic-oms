import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PurchaseService } from '../purchase/purchase.service';
import { InventoryService } from '../inventory/inventory.service';
import { AllocationService } from '../allocation/allocation.service';
import { AGENT_TOOLS } from './agent.tools';

const SYSTEM_PROMPT = `You are the Purchase & Operations agent for an FMCG Order Management System.
You have tools to check stock, get replenishment recommendations, explain how
an order was allocated (FEFO), and create purchase orders. Always call a tool
to get real data before making claims about stock or recommending purchases —
never guess numbers. When you recommend a purchase order, explain your
reasoning briefly (referencing days of cover / lead time) before asking the
user to confirm; only call create_purchase_order after the user has agreed to
a specific quantity in the conversation.`;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly inventoryService: InventoryService,
    private readonly allocationService: AllocationService,
  ) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
  }

  /**
   * Runs a full agentic tool-use loop for one user turn. `history` lets the
   * caller (web/mobile) maintain a running conversation — the API is
   * stateless per NestJS instance, so the client is responsible for sending
   * prior turns back each time (documented in the API's context-management
   * pattern).
   */
  async chat(userMessage: string, history: Anthropic.MessageParam[] = []) {
    const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: userMessage }];

    // Cap iterations so a misbehaving tool loop can't run indefinitely and
    // rack up API cost — important given the low-recurring-cost requirement.
    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: AGENT_TOOLS,
        messages,
      });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (toolUseBlocks.length === 0) {
        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
        return { reply: textBlock?.text ?? '', messages: [...messages, { role: 'assistant', content: response.content }] };
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await this.executeTool(toolUse.name, toolUse.input as Record<string, any>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    this.logger.warn('Agent hit max tool-call rounds without a final answer');
    return {
      reply: "I wasn't able to finish that within the allowed number of steps — could you narrow the request?",
      messages,
    };
  }

  private async executeTool(name: string, input: Record<string, any>) {
    switch (name) {
      case 'get_replenishment_recommendations':
        return this.purchaseService.recommendReplenishment(
          input.warehouseId,
          input.leadTimeDays ?? 10,
          input.targetCoverDays ?? 21,
        );
      case 'create_purchase_order':
        return this.purchaseService.createPurchaseOrder(input.manufacturerId, input.lines);
      case 'get_warehouse_stock':
        return this.inventoryService.getWarehouseStock(input.warehouseId);
      case 'explain_order_allocation':
        return this.allocationService.explainAllocation(input.orderId);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}
