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
}

export interface RetailerDto {
  id: string;
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
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  clientOrderId: string | null;
  status: string;
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
