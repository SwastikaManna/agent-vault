// Travel automation — flight status & check-in info via Amadeus Self-Service API
// (free tier: developers.amadeus.com). Boarding passes themselves require the
// airline's manage-booking page (no public API), so the agent fetches status,
// times, and check-in links, and saves itineraries into the vault.

export interface AmadeusConfig {
  clientId: string;
  clientSecret: string;
}

async function token(cfg: AmadeusConfig): Promise<string> {
  const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Amadeus auth failed (${res.status})`);
  const json = await res.json();
  return json.access_token as string;
}

export async function flightStatus(
  cfg: AmadeusConfig,
  flightNumber: string,
  date: string // YYYY-MM-DD
): Promise<string> {
  const t = await token(cfg);
  const res = await fetch(
    `https://test.api.amadeus.com/v2/schedule/flights?flightNumber=${encodeURIComponent(
      flightNumber
    )}&departureDate=${encodeURIComponent(date)}`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  if (!res.ok) throw new Error(`Flight lookup failed (${res.status})`);
  const json = await res.json();
  const flights = json.data ?? [];
  if (!flights.length) return `No flights found for ${flightNumber} on ${date}.`;

  const lines = flights.slice(0, 3).map((f: Record<string, any>) => {
    const pts = f.flightPoints ?? [];
    const dep = pts[0]?.iataCode ?? "?";
    const arr = pts[pts.length - 1]?.iataCode ?? "?";
    const depTime = pts[0]?.departure?.timings?.[0]?.value ?? "?";
    const arrTime = pts[pts.length - 1]?.arrival?.timings?.[0]?.value ?? "?";
    const carrier = f.flightDesignator?.carrierCode ?? "";
    const number = f.flightDesignator?.flightNumber ?? "";
    return `Flight ${carrier}${number} ${dep} → ${arr}: departs ${depTime}, arrives ${arrTime}. Status: ${
      f.status ?? "scheduled"
    }.`;
  });
  return (
    lines.join("\n") +
    "\n\nCheck-in links are issued by the airline's manage-booking page — saved itinerary notes include the booking reference to use there."
  );
}

export function amadeusFromEnv(): AmadeusConfig | null {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
