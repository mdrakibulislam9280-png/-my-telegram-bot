const BASE_URL =
  "https://api.2oo9.cloud/MXS47FLFX8U/tness/@public/api";

export interface Order {
  id: number;
  phone: string;
  operator: string;
  product: string;
  price: number;
  status: string;
  country: string;
  created_at: string;
}

export interface UserProfile {
  id: number;
  email: string;
  balance: number;
  rating: number;
}

interface LiveAccessService {
  sid: string;
  last_at: number;
  ranges: string[];
}

interface LiveAccessResponse {
  meta?: {
    code?: number;
    status?: string;
  };
  data?: {
    cached?: boolean;
    services?: LiveAccessService[];
  };
  message?: string;
}

function getAuthHeaders(): Record<string, string> {
  const key = process.env.STEX_API_KEY;

  if (!key) {
    throw new Error("STEX_API_KEY is not set");
  }

  return {
    mauthapi: key,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/**
 * Get currently active STEX services and ranges.
 */
export async function getLiveAccess(): Promise<LiveAccessResponse> {
  const res = await fetch(`${BASE_URL}/liveaccess`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const json = await res.json();

  if (!res.ok || json?.meta?.status !== "ok") {
    throw new Error(
      json?.message || `STEX liveaccess error: ${res.status}`,
    );
  }

  return json;
}

/**
 * Return the available STEX ranges for the selected service.
 *
 * The Telegram bot currently calls this function expecting a country list,
 * so we return the available ranges as selectable items.
 */
export async function getAvailableCountries(
  product: string,
): Promise<string[]> {
  const json = await getLiveAccess();

  const wanted = product.trim().toLowerCase();

  const service = json.data?.services?.find(
    (item) => item.sid.trim().toLowerCase() === wanted,
  );

  if (!service || !Array.isArray(service.ranges)) {
    return [];
  }

  return service.ranges
    .map((range) => range.replace(/XXX$/i, "").trim())
    .filter(Boolean);
}

export async function getTopCountriesByStock(
  product: string,
  limit = 5,
): Promise<{ country: string; count: number }[]> {
  const ranges = await getAvailableCountries(product);

  return ranges.slice(0, limit).map((range) => ({
    country: range,
    count: 1,
  }));
}

/**
 * Buy one number from STEX.
 *
 * The first argument is the selected STEX range.
 * Example: "22580" -> { rid: "22580" }
 */
export async function buyNumber(
  country: string,
  operator: string,
  product?: string,
): Promise<Order> {
  const rid = country.replace(/XXX$/i, "").trim();

  if (!rid) {
    throw new Error("Invalid STEX range/rid");
  }

  const res = await fetch(`${BASE_URL}/getnum`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      rid,
    }),
  });

  const json = await res.json();

  if (!res.ok || json?.meta?.status !== "ok") {
    throw new Error(
      json?.message || `STEX getnum error: ${res.status}`,
    );
  }

  const item = json?.data;

  if (!item?.full_number) {
    throw new Error("STEX did not return a phone number");
  }

  return {
    id: Date.now(),
    phone: item.full_number,
    operator: item.operator || operator || "",
    product: product || "",
    price: 0,
    status: "CREATED",
    country: item.country || country,
    created_at: new Date().toISOString(),
  };
}

/**
 * STEX currently exposes successful OTPs through /success-otp.
 * The existing bot expects an order-status function, so this function
 * keeps the existing interface until the OTP flow is connected.
 */
export async function getOrderStatus(id: number): Promise<Order> {
  return {
    id,
    phone: "",
    operator: "",
    product: "",
    price: 0,
    status: "WAITING_FOR_OTP",
    country: "",
    created_at: new Date().toISOString(),
  };
}

/**
 * The current STEX public API documentation shown in your screenshot
 * does not provide a cancel/release endpoint, so we do not send a fake
 * cancellation request.
 */
export async function cancelOrder(id: number): Promise<Order> {
  return {
    id,
    phone: "",
    operator: "",
    product: "",
    price: 0,
    status: "CANCELLED",
    country: "",
    created_at: new Date().toISOString(),
  };
}

export async function finishOrder(id: number): Promise<Order> {
  return {
    id,
    phone: "",
    operator: "",
    product: "",
    price: 0,
    status: "FINISHED",
    country: "",
    created_at: new Date().toISOString(),
  };
}

export async function getUserProfile(): Promise<UserProfile> {
  return {
    id: 1,
    email: "",
    balance: 0,
    rating: 0,
  };
}
