// Task Gym environments — tau-bench-style stateful tool environments.
// Each env defines tools (JSON schema), a state, and how tools mutate it.
// Pattern mirrors the amazon-tau-bench-tasks env abstraction (tool interfaces
// + state) but is self-contained — no Docker needed.

export interface GymTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GymEnv {
  id: string;
  label: string;
  description: string;
  tools: GymTool[];
  reset(): Record<string, unknown>;
  apply(tool: string, args: Record<string, unknown>): { ok: boolean; result: string; state: Record<string, unknown> };
}

// ---------------- Calendar env ----------------
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  attendees: string[];
}

function calendarEnv(): GymEnv {
  let events: CalendarEvent[] = [];
  let nextId = 4;

  const fmtEvents = () =>
    events.length
      ? events
          .map(
            (e) =>
              `#${e.id} "${e.title}" on ${e.date} ${e.start}-${e.end}` +
              (e.attendees.length ? ` (attendees: ${e.attendees.join(", ")})` : "")
          )
          .join("\n")
      : "No events scheduled.";

  return {
    id: "calendar",
    label: "Calendar",
    description: "A shared work calendar. Create, update, and cancel events.",
    tools: [
      {
        name: "list_events",
        description: "List all events on the calendar.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "create_event",
        description: "Schedule a new event.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            date: { type: "string", description: "YYYY-MM-DD" },
            start: { type: "string", description: "HH:MM 24h" },
            end: { type: "string", description: "HH:MM 24h" },
            attendees: { type: "array", items: { type: "string" } },
          },
          required: ["title", "date", "start", "end"],
        },
      },
      {
        name: "update_event",
        description: "Change one field of an existing event.",
        parameters: {
          type: "object",
          properties: {
            event_id: { type: "string" },
            field: { type: "string", enum: ["title", "date", "start", "end", "attendees"] },
            value: { type: "string" },
          },
          required: ["event_id", "field", "value"],
        },
      },
      {
        name: "delete_event",
        description: "Cancel an event by id.",
        parameters: {
          type: "object",
          properties: { event_id: { type: "string" } },
          required: ["event_id"],
        },
      },
    ],
    reset() {
      events = [
        { id: "1", title: "Sprint Planning", date: "2026-08-25", start: "10:00", end: "11:00", attendees: ["team"] },
        { id: "2", title: "Design Review", date: "2026-08-25", start: "14:00", end: "15:00", attendees: ["alice", "bob"] },
        { id: "3", title: "1:1 with Manager", date: "2026-08-26", start: "09:30", end: "10:00", attendees: [] },
      ];
      nextId = 4;
      return { events: fmtEvents() };
    },
    apply(tool, args) {
      switch (tool) {
        case "list_events":
          return { ok: true, result: fmtEvents(), state: { events: fmtEvents() } };
        case "create_event": {
          const ev: CalendarEvent = {
            id: String(nextId++),
            title: String(args.title ?? "Untitled"),
            date: String(args.date ?? ""),
            start: String(args.start ?? "09:00"),
            end: String(args.end ?? "10:00"),
            attendees: Array.isArray(args.attendees) ? args.attendees.map(String) : [],
          };
          events.push(ev);
          return { ok: true, result: `Created event #${ev.id}: "${ev.title}" on ${ev.date} ${ev.start}-${ev.end}`, state: { events: fmtEvents() } };
        }
        case "update_event": {
          const ev = events.find((e) => e.id === String(args.event_id));
          if (!ev) return { ok: false, result: `Event #${args.event_id} not found.`, state: { events: fmtEvents() } };
          const field = String(args.field);
          if (field === "attendees") {
            ev.attendees = String(args.value).split(",").map((s) => s.trim()).filter(Boolean);
          } else {
            (ev as unknown as Record<string, string>)[field] = String(args.value);
          }
          return { ok: true, result: `Updated event #${ev.id}.`, state: { events: fmtEvents() } };
        }
        case "delete_event": {
          const before = events.length;
          events = events.filter((e) => e.id !== String(args.event_id));
          return {
            ok: before !== events.length,
            result: before !== events.length ? `Deleted event #${args.event_id}.` : `Event #${args.event_id} not found.`,
            state: { events: fmtEvents() },
          };
        }
        default:
          return { ok: false, result: `Unknown tool: ${tool}`, state: { events: fmtEvents() } };
      }
    },
  };
}

// ---------------- Smart Home env ----------------
interface Device {
  name: string;
  type: "light" | "thermostat" | "lock" | "appliance";
  on?: boolean;
  temp?: number;
  locked?: boolean;
}

function smartHomeEnv(): GymEnv {
  let devices: Device[] = [];

  const fmt = () =>
    devices
      .map((d) => {
        if (d.type === "thermostat") return `${d.name} (thermostat): ${d.temp}°C`;
        if (d.type === "lock") return `${d.name} (lock): ${d.locked ? "locked" : "unlocked"}`;
        return `${d.name} (${d.type}): ${d.on ? "on" : "off"}`;
      })
      .join("\n");

  return {
    id: "smart_home",
    label: "Smart Home",
    description: "A connected home: lights, thermostat, locks, appliances.",
    tools: [
      {
        name: "list_devices",
        description: "List all devices and their current state.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "set_device",
        description: "Change a device's state: lights/appliances on|off, locks lock|unlock, thermostat a temperature in °C.",
        parameters: {
          type: "object",
          properties: {
            device: { type: "string" },
            action: { type: "string", enum: ["on", "off", "lock", "unlock"] },
            temp: { type: "number" },
          },
          required: ["device"],
        },
      },
    ],
    reset() {
      devices = [
        { name: "living_room_light", type: "light", on: true },
        { name: "bedroom_light", type: "light", on: true },
        { name: "kitchen_light", type: "light", on: false },
        { name: "thermostat", type: "thermostat", temp: 22 },
        { name: "front_door", type: "lock", locked: false },
        { name: "coffee_maker", type: "appliance", on: false },
      ];
      return { devices: fmt() };
    },
    apply(tool, args) {
      switch (tool) {
        case "list_devices":
          return { ok: true, result: fmt(), state: { devices: fmt() } };
        case "set_device": {
          const d = devices.find((x) => x.name === String(args.device));
          if (!d) return { ok: false, result: `Device "${args.device}" not found.`, state: { devices: fmt() } };
          if (typeof args.temp === "number" && d.type === "thermostat") {
            d.temp = args.temp;
            return { ok: true, result: `${d.name} set to ${d.temp}°C.`, state: { devices: fmt() } };
          }
          const action = String(args.action ?? "");
          if (d.type === "lock") {
            d.locked = action === "lock";
            return { ok: true, result: `${d.name} ${d.locked ? "locked" : "unlocked"}.`, state: { devices: fmt() } };
          }
          if (action === "on" || action === "off") {
            d.on = action === "on";
            return { ok: true, result: `${d.name} turned ${action}.`, state: { devices: fmt() } };
          }
          return { ok: false, result: `Invalid action "${action}" for ${d.name}.`, state: { devices: fmt() } };
        }
        default:
          return { ok: false, result: `Unknown tool: ${tool}`, state: { devices: fmt() } };
      }
    },
  };
}

export const GYM_ENVS: Record<string, GymEnv> = {
  calendar: calendarEnv(),
  smart_home: smartHomeEnv(),
};
