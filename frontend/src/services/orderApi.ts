import { calculateProgress, formatTimeLeft, normalizeQueueStatus, QueueJobStatus } from './craftingUtils';
import { api as apiClient } from '../hooks/useApi';
import axios from 'axios';

function toFetchStyleError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;

    if (status != null) {
      return new Error(`Fetch error ${status} ${statusText ?? ''}`.trim());
    }

    if (error.message) {
      return new Error(error.message);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Request failed');
}

// Shape returned by GET /api/Order
type OrderDto = {
  orderID: number;
  itemID: number;
  itemName: string;
  quantity: number;
  createdDateTime: string;
  totalTime?: number;
  timeElapsed?: number;
  status: string;
  branchID: number;
  employeeID: number;
  orderExpedite?: boolean;
};

type BranchDto = {
  branchID: number;
  branchName: string;
};

type OrderStatusUpdateDto = {
  status: string;
};

export type QueueJob = {
  orderID: number;
  id: string;
  name: string;
  qty: number;
  status: QueueJobStatus;
  progress: number;
  timeLeft: string;
  materials: string[];
  employeeName: string;
  createdDateTime: string;
  location: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  try {
    const response = await apiClient.get<T>(url);
    return response.data;
  } catch (error) {
    throw toFetchStyleError(error);
  }
}

export async function getOrders(): Promise<OrderDto[]> {
  return fetchJson<OrderDto[]>('Order');
}

export async function getUsers(): Promise<any[]> {
  return fetchJson<any[]>('User');
}

export async function getBranches(): Promise<BranchDto[]> {
  return fetchJson<BranchDto[]>('Branch');
}

export async function getCraftingQueue(): Promise<{ activeItems: QueueJob[]; queuedItems: QueueJob[] }> {
  const [orders, users, branches] = await Promise.all([getOrders(), getUsers(), getBranches()]);

  const employeeMap = (users ?? []).reduce<Record<number, string>>((map, user: any) => {
    if (user.employeeId != null) {
      map[user.employeeId] = user.employeeName;
    }

    return map;
  }, {});

  const branchMap = (branches ?? []).reduce<Record<number, string>>((map, branch) => {
    map[branch.branchID] = branch.branchName;
    return map;
  }, {});

  const jobs = (orders ?? [])
    .map((order) => ({ order, status: normalizeQueueStatus(order.status) }))
    .filter((entry): entry is { order: OrderDto; status: QueueJobStatus } => entry.status != null)
    .sort((left, right) => new Date(left.order.createdDateTime).getTime() - new Date(right.order.createdDateTime).getTime())
    .map(({ order, status }) => ({
      orderID: order.orderID,
      id: `order-${order.orderID}`,
      name: order.itemName || `Order ${order.orderID}`,
      qty: order.quantity ?? 1,
      status,
      progress: calculateProgress(order.totalTime, order.timeElapsed),
      timeLeft: formatTimeLeft(order.totalTime, order.timeElapsed, order.orderExpedite === true),
      materials: [order.itemName || `Item ${order.itemID}`],
      employeeName: employeeMap[order.employeeID] ?? 'Unknown Employee',
      createdDateTime: order.createdDateTime,
      location: branchMap[order.branchID] ?? `Branch ${order.branchID}`,
    } satisfies QueueJob));

  return {
    activeItems: jobs.filter((job) => job.status === 'Active' || job.status === 'Paused'),
    queuedItems: jobs.filter((job) => job.status === 'Queued'),
  };
}

export async function updateOrderStatus(orderId: number, status: string): Promise<void> {
  try {
    await apiClient.put(`Order/${orderId}/status`, { status } satisfies OrderStatusUpdateDto);
  } catch (error) {
    throw toFetchStyleError(error);
  }
}

export async function deleteOrder(orderId: number): Promise<void> {
  try {
    await apiClient.delete(`Order/${orderId}`);
  } catch (error) {
    throw toFetchStyleError(error);
  }
}

const orderApi = {
  getOrders,
  getUsers,
  getBranches,
  getCraftingQueue,
  updateOrderStatus,
  deleteOrder,
};

export default orderApi;
