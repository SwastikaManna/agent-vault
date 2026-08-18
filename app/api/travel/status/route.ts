import { flightStatus } from "@/lib/travel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { flightNumber?: string; date?: string; clientId?: string; clientSecret?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const clientId = body.clientId || process.env.AMADEUS_CLIENT_ID;
  const clientSecret = body.clientSecret || process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "Amadeus not configured — get a free key at developers.amadeus.com and add it in Settings." },
      { status: 400 }
    );
  }
  try {
    const text = await flightStatus(
      { clientId, clientSecret },
      String(body.flightNumber ?? ""),
      String(body.date ?? "")
    );
    return Response.json({ ok: true, text });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
