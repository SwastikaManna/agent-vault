"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plane, Search, Save, FileText } from "lucide-react";
import TopBar from "@/components/topbar";

export default function Travel() {
  const [flight, setFlight] = useState("");
  const [date, setDate] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [itineraries, setItineraries] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((j) => {
        setItineraries(
          (j.nodes ?? [])
            .filter((n: { path: string; type: string }) => n.type === "file" && n.path.startsWith("Travel/"))
            .map((n: { path: string }) => n.path)
        );
      })
      .catch(() => {});
  }, []);

  async function lookup() {
    if (!flight.trim() || !date.trim()) return;
    setLoading(true);
    setError("");
    setResult("");
    setSaved(false);
    try {
      const res = await fetch("/api/travel/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flightNumber: flight.trim(), date: date.trim() }),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error ?? "Lookup failed");
      else setResult(j.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveItinerary() {
    if (!result) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `Travel/${flight.trim()} ${date}.md`,
        content: `---\ncreated: ${stamp}\ntags: [travel, itinerary]\n---\n\n# ${flight.trim()} — ${date}\n\n${result}\n\n_Note: check-in and boarding passes come from the airline's manage-booking page using your booking reference._`,
      }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <>
      <TopBar title="Travel" subtitle="Flight status, itineraries, and check-in info — automatically" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-8 py-10">
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Plane size={15} className="text-accent2" />
              <h2 className="text-[15px] font-[510] text-ink">Flight status</h2>
            </div>
            <p className="text-[12px] text-muted mb-4">
              Powered by Amadeus (free self-service tier — add your key in Settings, or the team
              fetches status directly in the Workspace with the{" "}
              <span className="mono text-silver">flight_status</span> tool).
            </p>
            <div className="flex gap-2">
              <input className="input mono" placeholder="Flight number — e.g. AI123" value={flight} onChange={(e) => setFlight(e.target.value)} />
              <input className="input mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="btn btn-primary shrink-0" onClick={() => void lookup()} disabled={loading || !flight || !date}>
                <Search size={13} /> {loading ? "Checking…" : "Check"}
              </button>
            </div>
            {error && <p className="mt-3 text-[12px] text-warn">{error}</p>}
            {result && (
              <div className="mt-4">
                <pre className="text-[12px] mono text-muted bg-panel border border-linesub rounded p-3 whitespace-pre-wrap">{result}</pre>
                <button className="btn mt-3" onClick={() => void saveItinerary()} disabled={saved}>
                  <Save size={12} className={saved ? "text-ok" : ""} />
                  {saved ? "Saved to vault ✓" : "Save itinerary note"}
                </button>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="text-[13px] font-[510] text-silver mb-3">Itineraries in the vault</h2>
            {itineraries.length === 0 ? (
              <p className="text-[12px] text-faint">
                None yet. Ask the team in the Workspace: <span className="mono">“check my flight AI123 on 2026-08-20 and save the itinerary”</span> — it
                fetches status and files the note itself.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {itineraries.map((n) => (
                  <li key={n}>
                    <Link href={`/vault?note=${encodeURIComponent(n)}`} className="flex items-center gap-2 text-[12.5px] text-muted hover:text-silver">
                      <FileText size={12} className="text-faint" />
                      <span className="mono">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
