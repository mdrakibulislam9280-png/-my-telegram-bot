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

export async function getAvailableCountries(
  product: string,
): Promise<string[]> {
  return ["Bangladesh", "Global", "United Kingdom", "USA", "Russia"];
}

export async function getTopCountriesByStock(
  product: string,
  limit = 5,
): Promise<{ country: string; count: number }[]> {
  return [
    { country: "Bangladesh", count: 10 },
    { country: "Global", count: 5 }
  ].slice(0, limit);
}

export async function buyNumber(
  country: string,
  operator: string,
  product: string,
): Promise<Order> {
  const rid = product.replace(/\D/g, "") || "26134";

  const url = `${BASE_URL}/getnum`;
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rid }),
  });

  if (!res.ok) {
    throw new Error(`Stex SMS API error: ${res.status}`);
  }

  const json = await res.json();
  const item = json.data || {};

  return {
    id: Date.now(),
    phone: item.full_number || "+8801000000000",
    operator: item.operator || "any",
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
    balance: 500,
    rating: 5,
  };
    }
