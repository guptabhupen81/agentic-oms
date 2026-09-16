// Mirrors the backend's response/request shapes exactly (same source of
// truth as the Android DTOs) — this is what "same logic, both platforms"
// looks like in practice: neither client re-derives these shapes, they both
// just describe what the one backend already returns.

export interface LoginResponse {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
}

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  uom: string;
  gstRatePercent: string;
  isActive: boolean;
  hierarchyNodeId?: string;
  manufacturerId?: string;
  hsnCode?: string | null;
  defaultUnitPrice?: string;
  minOrderQty?: string | null;
  maxOrderQty?: string | null;
  primaryMoq?: string | null;
  caseQty?: string | null;
  unitWeightKg?: string | null;
  unitVolumeCbm?: string | null;
}

export interface TruckDto {
  id: string;
  registration: string;
  name: string;
  capacityWeightKg: string | null;
  capacityVolumeCbm: string | null;
  isActive: boolean;
}

export interface TruckInput {
  registration: string;
  name: string;
  capacityWeightKg?: number;
  capacityVolumeCbm?: number;
}

export interface RetailerDto {
  id: string;
  code: string;
  name: string;
  gstin: string | null;
  address: string | null;
  creditLimitAmount: string;
  creditUsedAmount: string;
  isActive: boolean;
}

export interface WarehouseDto {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

export interface VanDto {
  id: string;
  registration: string;
  name: string;
  isActive: boolean;
}

export interface ManufacturerDto {
  id: string;
  name: string;
  gstin: string | null;
}

export interface HierarchyNodeDto {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  children: HierarchyNodeDto[];
}

// --- Master create/update payloads (numbers, not decimal-strings — distinct
// from the *Dto response types above, which mirror Prisma's Decimal-as-
// string JSON serialization). ---

export interface RetailerInput {
  code: string;
  name: string;
  gstin?: string;
  address?: string;
  creditLimitAmount?: number;
}

export interface WarehouseInput {
  name: string;
  code: string;
  address?: string;
}

export interface VanInput {
  registration: string;
  name: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  hierarchyNodeId: string;
  manufacturerId: string;
  uom: string;
  hsnCode?: string;
  gstRatePercent?: number;
  defaultUnitPrice?: number;
  minOrderQty?: number;
  maxOrderQty?: number;
  primaryMoq?: number;
  caseQty?: number;
  unitWeightKg?: number;
  unitVolumeCbm?: number;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  clientOrderId: string | null;
  status: string;
}

export interface CreateOrderLineInput {
  productId: string;
  orderedQty: number;
  discountPercent?: number;
  isFreeItem?: boolean;
}

export interface CreateOrderInput {
  clientOrderId: string;
  retailerId: string;
  createdById: string;
  sourceType: string;
  overallDiscountPercent?: number;
  lines: CreateOrderLineInput[];
}

export interface OrderListItemDto {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  overallDiscountPercent: string;
  estimatedValue: string;
  retailer: { name: string; code: string };
  lines: { orderedQty: string }[];
}

export interface OrderValueLineDto {
  orderLineId: string;
  productId: string;
  productName: string;
  orderedQty: string;
  unitPrice: string;
  discountPercent: string;
  isFreeItem: boolean;
  taxableValue: string;
  taxAmount: string;
  lineTotal: string;
}

export interface OrderValueResultDto {
  orderId: string;
  overallDiscountPercent: string;
  lines: OrderValueLineDto[];
  subTotal: string;
  totalTax: string;
  totalValue: string;
}

export interface StockSummaryDto {
  productId: string;
  sku: string;
  stockInHand: string;
}

export interface BatchInfo {
  batchNumber: string;
  expiryDate: string;
}

export interface AllocationInfo {
  batchId: string;
  batch: BatchInfo;
  orderLine?: { productId: string };
}

export interface PicklistLineDto {
  id: string;
  quantity: string;
  pickedQty: string;
  allocation: AllocationInfo;
}

export interface PicklistDto {
  id: string;
  picklistNumber: string;
  warehouseId: string;
  status: string;
  lines: PicklistLineDto[];
}

export interface PicklistListItemDto {
  id: string;
  picklistNumber: string;
  status: string;
  createdAt: string;
  warehouse: { name: string };
}

export interface CompletePicklistResponse {
  picklistId: string;
  status: string;
  discrepancies: { picklistLineId: string; requested: string; picked: string }[];
}

export interface VanLoadLineDto {
  id: string;
  batchId: string;
  loadedQty: string;
  soldQty: string;
  unloadedQty: string;
}

export interface VanLoadDto {
  id: string;
  vanId: string;
  warehouseId: string;
  status: string;
  lines: VanLoadLineDto[];
}

export interface VanLoadListItemDto {
  id: string;
  status: string;
  loadDate: string;
  van: { name: string; registration: string };
  warehouse: { name: string };
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
}

export interface AllocationResultLine {
  orderLineId: string;
  productId: string;
  orderedQty: string;
  allocatedQty: string;
  shortfallQty: string;
  batchesUsed: { batchId: string; batchNumber: string; expiryDate: string; qtyTaken: string }[];
}

export interface AllocationResult {
  orderId: string;
  fullyAllocated: boolean;
  lines: AllocationResultLine[];
}

export interface ValidationCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ValidateOrderResult {
  orderId: string;
  passed: boolean;
  checks: ValidationCheckResult[];
  agentTaskId?: string;
  dueAt?: string;
}

export interface AgentTaskDto {
  id: string;
  taskType: string;
  entityType: string;
  entityId: string;
  reasonNote: string;
  status: string;
  dueAt: string;
  createdAt: string;
}

export interface AgentEventDto {
  id: string;
  agentName: string;
  entityType: string;
  entityId: string;
  message: string;
  createdAt: string;
}

// --- Inventory visibility ---

export interface InventoryStockDto {
  id: string;
  quantityOnHand: string;
  quantityAllocated: string;
  product: { name: string; sku: string };
  batch: { batchNumber: string; expiryDate: string };
  warehouse: { name: string; code: string };
}

// --- Forecasting ---

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

export interface ForecastFactorDto {
  id: string;
  name: string;
  factorType: string;
  hierarchyNodeId: string | null;
  productId: string | null;
  upliftPercent: string;
  startDate: string;
  endDate: string;
  notes: string | null;
}

export interface RunForecastInput {
  quarterLabel: string;
  growthPercent: number;
  lines: { productId: string; baseQty: number }[];
}

export interface ForecastLineDto {
  id: string;
  productId: string;
  baseQty: string;
  growthAdjustedQty: string;
  finalQty: string;
  appliedFactors: string;
  product?: { name: string; sku: string };
}

export interface ForecastDto {
  id: string;
  quarterLabel: string;
  growthPercent: string;
  createdAt: string;
  lines: ForecastLineDto[];
}

// --- Purchase / Demand ---

export interface ReplenishmentRecommendationDto {
  productId: string;
  sku: string;
  manufacturerId: string;
  currentStock: string;
  averageDailySales: string;
  daysOfCoverRemaining: string;
  recommendedOrderQty: string;
  rationale: string;
}

export interface PurchaseOrderListItemDto {
  id: string;
  poNumber: string;
  status: string;
  createdAt: string;
  manufacturer: { name: string };
  lines: { id: string; orderedQty: string; receivedQty: string; product: { id: string; name: string } }[];
}
