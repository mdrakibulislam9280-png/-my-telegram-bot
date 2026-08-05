/**
 * Maps 5sim API country keys (lowercase) to ISO 3166-1 alpha-2 codes.
 * Used to generate flag emojis and display names.
 */
const COUNTRY_ISO: Record<string, string> = {
  russia: "RU",
  ukraine: "UA",
  china: "CN",
  indonesia: "ID",
  india: "IN",
  brazil: "BR",
  philippines: "PH",
  vietnam: "VN",
  myanmar: "MM",
  cambodia: "KH",
  malaysia: "MY",
  thailand: "TH",
  bangladesh: "BD",
  pakistan: "PK",
  nigeria: "NG",
  kenya: "KE",
  ghana: "GH",
  ethiopia: "ET",
  tanzania: "TZ",
  egypt: "EG",
  morocco: "MA",
  southafrica: "ZA",
  cameroon: "CM",
  senegal: "SN",
  ivory_coast: "CI",
  ivorycoast: "CI",
  angola: "AO",
  uganda: "UG",
  zimbabwe: "ZW",
  zambia: "ZM",
  mozambique: "MZ",
  rwanda: "RW",
  malawi: "MW",
  botswana: "BW",
  namibia: "NA",
  sierraleone: "SL",
  liberia: "LR",
  gambia: "GM",
  guinea: "GN",
  niger: "NE",
  mali: "ML",
  burkinafaso: "BF",
  togo: "TG",
  benin: "BJ",
  gabon: "GA",
  congo: "CG",
  drc: "CD",
  madagascar: "MG",
  comoros: "KM",
  mauritius: "MU",
  seychelles: "SC",
  mexico: "MX",
  colombia: "CO",
  argentina: "AR",
  chile: "CL",
  peru: "PE",
  venezuela: "VE",
  ecuador: "EC",
  bolivia: "BO",
  paraguay: "PY",
  uruguay: "UY",
  panama: "PA",
  costarica: "CR",
  guatemala: "GT",
  honduras: "HN",
  elsalvador: "SV",
  nicaragua: "NI",
  dominicanrepublic: "DO",
  haiti: "HT",
  cuba: "CU",
  jamaica: "JM",
  trinidadandtobago: "TT",
  usa: "US",
  canada: "CA",
  uk: "GB",
  germany: "DE",
  france: "FR",
  italy: "IT",
  spain: "ES",
  portugal: "PT",
  netherlands: "NL",
  belgium: "BE",
  switzerland: "CH",
  austria: "AT",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  poland: "PL",
  czechrepublic: "CZ",
  slovakia: "SK",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  serbia: "RS",
  croatia: "HR",
  slovenia: "SI",
  bosniaandherzegovina: "BA",
  northmacedonia: "MK",
  albania: "AL",
  greece: "GR",
  turkey: "TR",
  cyprus: "CY",
  malta: "MT",
  latvia: "LV",
  lithuania: "LT",
  estonia: "EE",
  belarus: "BY",
  moldova: "MD",
  georgia: "GE",
  armenia: "AM",
  azerbaijan: "AZ",
  kazakhstan: "KZ",
  uzbekistan: "UZ",
  kyrgyzstan: "KG",
  tajikistan: "TJ",
  turkmenistan: "TM",
  mongolia: "MN",
  northkorea: "KP",
  southkorea: "KR",
  japan: "JP",
  taiwan: "TW",
  hongkong: "HK",
  singapore: "SG",
  brunei: "BN",
  laos: "LA",
  nepal: "NP",
  srilanka: "LK",
  afghanistan: "AF",
  iran: "IR",
  iraq: "IQ",
  saudiarabia: "SA",
  uae: "AE",
  qatar: "QA",
  kuwait: "KW",
  bahrain: "BH",
  oman: "OM",
  yemen: "YE",
  jordan: "JO",
  israel: "IL",
  lebanon: "LB",
  syria: "SY",
  sudan: "SD",
  libya: "LY",
  algeria: "DZ",
  tunisia: "TN",
  somalia: "SO",
  eritrea: "ER",
  djibouti: "DJ",
  newzealand: "NZ",
  australia: "AU",
  papuanewguinea: "PG",
  fiji: "FJ",
  solomonislands: "SB",
  vanuatu: "VU",
  samoa: "WS",
  tonga: "TO",
  kiribati: "KI",
  nauru: "NR",
  palau: "PW",
  marshallislands: "MH",
  micronesia: "FM",
  timorleste: "TL",
};

/**
 * Convert a 5sim country key to an ISO 2-letter code.
 * Falls back to treating the key as the code itself (uppercased).
 */
export function toIsoCode(fivesimKey: string): string {
  const normalized = fivesimKey.toLowerCase().replace(/[\s_-]/g, "");
  return COUNTRY_ISO[normalized] ?? fivesimKey.slice(0, 2).toUpperCase();
}

/**
 * Convert an ISO 2-letter country code to a flag emoji.
 */
export function isoToFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((ch) => String.fromCodePoint(ch.charCodeAt(0) + 127397))
    .join("");
}

/**
 * Convert a 5sim country key to a human-readable display name.
 */
export function toDisplayName(fivesimKey: string): string {
  // Replace underscores/hyphens with spaces and title-case each word
  return fivesimKey
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get flag + display name for a 5sim country key.
 * e.g. "russia" -> "🇷🇺 Russia"
 */
export function formatCountry(fivesimKey: string): string {
  const iso = toIsoCode(fivesimKey);
  const flag = isoToFlag(iso);
  const name = toDisplayName(fivesimKey);
  return `${flag} ${name}`;
}
