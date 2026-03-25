import type {
  ReserveGatewayConfig,
  ReservePutRequestData,
  ReserveGatewayResponse,
} from "./types";

const GATEWAY_BASE_URL = "https://www.reservecloud.com";
const GATEWAY_TIMEOUT_MS = 60_000;
const PAGE_SIZE = 100;

/**
 * Reserve Interactive (Infor SCS) gateway HTTP client.
 * Wraps all communication with the Reserve cloud gateway.
 */
export class ReserveGatewayClient {
  private authHeader: string;

  constructor(private config: ReserveGatewayConfig) {
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.username}:${config.password}`).toString("base64");
  }

  // --------------- Read (GET) endpoints ---------------

  async fetchEventData(
    options: { firstResult?: number; maxResults?: number } = {}
  ): Promise<unknown[]> {
    return this.fetchPaginated("EnduraCodeEventData", options);
  }

  async fetchFunctionData(
    options: {
      firstResult?: number;
      maxResults?: number;
      endDateAfter?: Date;
      eventUniqueId?: string;
    } = {}
  ): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (options.endDateAfter) {
      params.endDate = formatDateForReserve(options.endDateAfter);
    }
    if (options.eventUniqueId) {
      params.eventUniqueId = options.eventUniqueId;
    }
    return this.fetchPaginated("EnduraCodeFunctionData", options, params);
  }

  async fetchAccountData(
    options: { firstResult?: number; maxResults?: number } = {}
  ): Promise<unknown[]> {
    return this.fetchPaginated("EnduraCodeAccountData", options);
  }

  async fetchContactData(
    options: { firstResult?: number; maxResults?: number } = {}
  ): Promise<unknown[]> {
    return this.fetchPaginated("EnduraCodeContactData", options);
  }

  // --------------- Write (POST) endpoints ---------------

  async importAccount(payload: ReservePutRequestData): Promise<ReserveGatewayResponse> {
    return this.postToGateway("AccountImport", payload);
  }

  async importContact(
    payload: ReservePutRequestData,
    limitToAccount = true
  ): Promise<ReserveGatewayResponse> {
    return this.postToGateway("ContactImport", payload, {
      limitContactsToAccount: limitToAccount ? "true" : "false",
    });
  }

  async importEventFunction(payload: ReservePutRequestData): Promise<ReserveGatewayResponse> {
    return this.postToGateway("EventFunctionImport", payload);
  }

  // --------------- Connection test ---------------

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const url = new URL("/gateway/request", GATEWAY_BASE_URL);
      url.searchParams.set("requestName", "EnduraCodeAccountData");
      url.searchParams.set("requestGuid", crypto.randomUUID().toUpperCase());
      url.searchParams.set("maxResults", "1");
      url.searchParams.set("format", "hierarchical");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // --------------- Internal helpers ---------------

  private async fetchPaginated(
    requestName: string,
    options: { firstResult?: number; maxResults?: number },
    extraParams: Record<string, string> = {}
  ): Promise<unknown[]> {
    const allResults: unknown[] = [];
    let firstResult = options.firstResult ?? 0;
    const maxPerPage = options.maxResults ?? PAGE_SIZE;
    let totalCount: number | null = null;

    while (totalCount === null || firstResult < totalCount) {
      const url = new URL("/gateway/request", GATEWAY_BASE_URL);
      url.searchParams.set("requestName", requestName);
      url.searchParams.set("requestGuid", crypto.randomUUID().toUpperCase());
      url.searchParams.set("maxResults", String(maxPerPage));
      url.searchParams.set("firstResult", String(firstResult));
      url.searchParams.set("orderByField", "uniqueId");
      url.searchParams.set("format", "hierarchical");

      for (const [key, value] of Object.entries(extraParams)) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(
          `Reserve gateway error: ${response.status} ${response.statusText}`
        );
      }

      const body = await response.json();

      // Hierarchical format: { count: N, results: [...] }
      const items: unknown[] = body.results ?? [];
      totalCount = typeof body.count === "number" ? body.count : items.length;

      if (items.length === 0) break;

      allResults.push(...items);
      firstResult += items.length;
    }

    return allResults;
  }

  private async postToGateway(
    requestName: string,
    payload: ReservePutRequestData,
    extraParams: Record<string, string> = {}
  ): Promise<ReserveGatewayResponse> {
    const requestGuid = crypto.randomUUID().toUpperCase();

    const url = new URL("/gateway/request", GATEWAY_BASE_URL);
    url.searchParams.set("requestName", requestName);
    url.searchParams.set("requestGuid", requestGuid);
    url.searchParams.set("mode", "apply");

    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Reserve gateway POST error: ${response.status} ${response.statusText} - ${text}`
      );
    }

    const body = await response.json();
    return body as ReserveGatewayResponse;
  }
}

// --------------- Response helpers ---------------

/** Extract event.uniqueId from a gateway response (used after EventFunctionImport) */
export function extractEventUniqueId(response: ReserveGatewayResponse): string | null {
  return response.results?.[0]?.uniqueIds?.["event.uniqueId"] ?? null;
}

/** Extract uniqueId from a gateway response (used after AccountImport / ContactImport) */
export function extractUniqueId(response: ReserveGatewayResponse): string | null {
  return response.results?.[0]?.uniqueIds?.["uniqueId"] ?? null;
}

// --------------- Date/time formatting ---------------

/** Format date as M/d/yyyy for Reserve gateway */
export function formatDateForReserve(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

/** Format time as h:mm AM/PM for Reserve gateway */
export function formatTimeForReserve(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

/** Parse Reserve date string (M/d/yyyy) to Date */
export function parseReserveDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 2000) return null;
  return new Date(year, month, day);
}

/** Parse Reserve time string (h:mm AM/PM) to hours and minutes */
export function parseReserveTime(
  timeStr: string
): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

/** Combine a date and Reserve time string into a Date */
export function combineDateAndTime(
  date: Date,
  timeStr: string
): Date | null {
  const time = parseReserveTime(timeStr);
  if (!time) return null;
  const result = new Date(date);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
}
