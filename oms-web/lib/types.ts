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
