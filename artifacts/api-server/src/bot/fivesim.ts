const BASE_URL = "https://5sim.net";

export interface PricesResponse {
  [country: string]: {
    [operator: string]: {
      cost: number;
      count: number;
      rate: number;
    };
  };
}

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

function getAuthHeaders(): Record<string, string> {
  const key = process.env["FIVESIM_API_KEY"];
  if (!key) throw new Error("FIVESIM_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
}

/**
 * Fetch countries with available stock > 0 for a product.
 * Uses the guest endpoint — no auth required.
 */
export async function getAvailableCountries(
  product: string,
): Promise<string[]> {
  const url = `${BASE_URL}/v1/guest/prices?product=${encodeURIComponent(product)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`5sim prices API error: ${res.status}`);
  }
  const data = (await res.json()) as PricesResponse;

  const available: string[] = [];
  for (const [country, operators] of Object.entries(data)) {
    const hasStock = Object.values(operators).some((op) => op.count > 0);
    if (hasStock) available.push(country);
  }
  return available;
}

/**
 * Buy an activation number.
 * Returns the Order on success, throws on failure.
 */
export async function buyNumber(
  country: string,
  product: string,
): Promise<Order> {
  const url = `${BASE_URL}/v1/user/buy/activation/${encodeURIComponent(country)}/any/${encodeURIComponent(product)}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`5sim buy error ${res.status}: ${text}`);
  }
  return res.json() as Promise<Order>;
}

/**
 * Cancel an active order.
 */
export async function cancelOrder(orderId: number): Promise<void> {
  const url = `${BASE_URL}/v1/user/cancel/${orderId}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`5sim cancel error ${res.status}: ${text}`);
  }
}

/**
 * Get user profile (includes balance).
 */
export async function getUserProfile(): Promise<UserProfile> {
  const url = `${BASE_URL}/v1/user/profile`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`5sim profile error ${res.status}: ${text}`);
  }
  return res.json() as Promise<UserProfile>;
}
