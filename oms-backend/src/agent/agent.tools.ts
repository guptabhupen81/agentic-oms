import Anthropic from '@anthropic-ai/sdk';

/**
 * Tool definitions exposed to the LLM agent. Each tool maps 1:1 to an
 * existing, already-tested service method — the agent never gets a path to
 * write raw SQL or bypass business logic; it can only call the same
 * operations a human user could trigger via the REST API.
 */
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_replenishment_recommendations',
    description:
      'Get Purchase Agent replenishment recommendations for a warehouse: products whose stock covers fewer days than the manufacturer lead time.',
    input_schema: {
      type: 'object',
      properties: {
        warehouseId: { type: 'string' },
        leadTimeDays: { type: 'number', description: 'Manufacturer lead time in days. Default 10.' },
        targetCoverDays: { type: 'number', description: 'Target days of stock cover to replenish to. Default 21.' },
      },
      required: ['warehouseId'],
    },
  },
  {
    name: 'create_purchase_order',
    description: 'Create a Purchase Order to a Manufacturer for given product quantities.',
    input_schema: {
      type: 'object',
      properties: {
        manufacturerId: { type: 'string' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              orderedQty: { type: 'number' },
            },
            required: ['productId', 'orderedQty'],
          },
        },
      },
      required: ['manufacturerId', 'lines'],
    },
  },
  {
    name: 'get_warehouse_stock',
    description: 'Get current stock on hand for a warehouse, broken down by product and batch (with expiry dates).',
    input_schema: {
      type: 'object',
      properties: { warehouseId: { type: 'string' } },
      required: ['warehouseId'],
    },
  },
  {
    name: 'explain_order_allocation',
    description:
      'Explain how a specific order was allocated: which batches were used, in what quantities, and why (FEFO reasoning).',
    input_schema: {
      type: 'object',
      properties: { orderId: { type: 'string' } },
      required: ['orderId'],
    },
  },
];
