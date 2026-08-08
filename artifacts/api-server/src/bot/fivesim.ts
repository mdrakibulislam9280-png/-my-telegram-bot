const BASE_URL = "https://api.2oo9.cloud/MX547FLFX8U/tness/@public/api";

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
  const key = "M2G10SHOAN3";
  if (!key) throw new Error("API KEY is not set");
  return {
    "mauthapi": key,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };
}

/**
 * Fetch countries with available stock > 0 for a product.
 */
export async function getAvailableCountries(
  product: string,
): Promise<string[]> {
  const url = `${BASE_URL}/getnum`;
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rid: product }),
  });

  if (!res.ok) {
    throw new Error(`Stex SMS API error: ${res.status}`);
  }

  const data = await res.json();
  
  if (data && data.success && data.data) {
    return [data.data.country || "Any"];
  }

  return ["Global"];
}

/**
 * Fetch top N countries by total stock for a product.
 */
export async function getTopCountriesByStock(
  product: string,
  limit = 5,
): Promise<{ country: string; count: number }[]> {
  const url = `${BASE_URL}/getnum`;
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rid: product }),
  });

  if (!res.ok) {
    throw new Error(`Stex SMS API error: ${res.status}`);
  }

  const data = await res.json();
  const results: { country: string; count: number }[] = [];

  if (data && data.success && data.data) {
    results.push({
      country: data.data.country || "Global",
      count: 1
    });
  } else {
    results.push({
      country: "Global",
      count: 1
    });
  }

  return results.slice(0, limit);
}

export async function buyNumber(
  country: string,
  operator: string,
  product: string,
): Promise<Order> {
  const url = `${BASE_URL}/getnum`;
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rid: product }),
  });

  if (!res.ok) {
    throw new Error(`Stex SMS API error: ${res.status}`);
  }

  const json = await res.json();
  const item = json.data || {};

  return {
    id: Date.now(),
    phone: item.full_number || "",
    operator: item.operator || operator,
    product: product,
    price: 0,
    status: "CREATED",
    country: item.country || country,
    created_at: new Date().toISOString(),
  };
}

export async function getOrderStatus(id: number): Promise<Order> {
  return {
    id,
    phone: "",
    operator: "",
    product: "",
    price: 0,
    status: "RECEIVED",
    country: "",
    created_at: new Date().toISOString(),
  };
}

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
    email: "user@stexsms.com",
    balance: 100,
    rating: 5,
  };
}
