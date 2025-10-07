const FALLBACK_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kuala_Lumpur",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Manila",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

let cachedZones: string[] | null = null;

export function getAllTimezones(): string[] {
  if (cachedZones) return cachedZones;
  if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
    try {
      const zones = (Intl as any).supportedValuesOf("timeZone") as string[];
      cachedZones = Array.from(new Set(zones)).sort();
      return cachedZones;
    } catch {
      // fall back
    }
  }
  cachedZones = [...FALLBACK_TIMEZONES];
  return cachedZones;
}

export function groupTimezones(): Record<string, string[]> {
  const zones = getAllTimezones();
  return zones.reduce<Record<string, string[]>>((acc, zone) => {
    const [region = "Other"] = zone.split("/");
    if (!acc[region]) acc[region] = [];
    acc[region].push(zone);
    return acc;
  }, {});
}

export function detectLocalTimezone(): string {
  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return tz;
    } catch {
      // ignore
    }
  }
  return "UTC";
}
