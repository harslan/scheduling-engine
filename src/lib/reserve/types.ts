// Reserve Interactive (Infor SCS) gateway types

export interface ReserveGatewayConfig {
  username: string;
  password: string;
  siteName: string;
}

export interface ReservePutRequestData {
  header: string[];
  data: string[][];
}

export interface ReserveEventGeneralData {
  uniqueId: string;
  eventNumber?: string;
  eventIdFieldValue?: string;
  [key: string]: unknown;
}

export interface ReserveFunctionData {
  uniqueId: string;
  eventUniqueId: string;
  functionName?: string;
  locationName?: string;
  setupStyle?: string;
  functionType?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  estimatedAttendance?: number;
  [key: string]: unknown;
}

export interface ReserveAccountData {
  uniqueId: string;
  name: string;
  [key: string]: unknown;
}

export interface ReserveContactData {
  uniqueId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  account?: {
    uniqueId: string;
    name: string;
  };
  [key: string]: unknown;
}

export interface ReserveGatewayResponse {
  results: {
    uniqueIds: Record<string, string>;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

export interface ReserveImportPreviewItem {
  reserveUniqueId: string;
  reserveEventNumber?: string;
  action: "create" | "update" | "delete";
  title: string;
  functions: {
    locationName: string;
    setupStyle: string;
    functionType: string;
    startDate: string;
    startTime: string;
    endTime: string;
    attendeeCount: number;
  }[];
  mappedRoom?: string;
  mappedConfigType?: string;
  mappedEventType?: string;
  conflicts: string[];
  existingEventId?: string;
}

export interface ReserveSyncResult {
  success: boolean;
  eventsProcessed: number;
  errors: string[];
  details?: Record<string, unknown>;
}

export type ReserveWebhookAction =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_CANCELLED";
