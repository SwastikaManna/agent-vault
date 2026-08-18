// Task Gym tasks — tau-bench-style: instruction + expected-state check.
// Shape mirrors amazon-tau-bench-tasks JSON (env, task.instruction, expected outputs).

export interface GymTask {
  id: string;
  env: string;
  title: string;
  instruction: string;
  difficulty: "easy" | "medium" | "hard";
  check: (state: Record<string, unknown>) => { passed: boolean; detail: string };
}

const cal = "calendar";
const sh = "smart_home";

export const GYM_TASKS: GymTask[] = [
  {
    id: "cal-1",
    env: cal,
    title: "Reschedule a meeting",
    instruction:
      "The Design Review (event #2) clashes with Sprint Planning. Move Design Review to 16:00–17:00 on the same day (2026-08-25).",
    difficulty: "easy",
    check: (s) => {
      const evs: string = String(s.events ?? "");
      return {
        passed: evs.includes('"Design Review" on 2026-08-25 16:00-17:00'),
        detail: evs,
      };
    },
  },
  {
    id: "cal-2",
    env: cal,
    title: "Book a meeting with the team",
    instruction:
      "Schedule a 30-minute 'Status Sync' on 2026-08-27 at 11:00 with the whole team as attendees.",
    difficulty: "easy",
    check: (s) => {
      const evs: string = String(s.events ?? "");
      return {
        passed:
          evs.includes('"Status Sync" on 2026-08-27 11:00-11:30') && evs.includes("attendees: team"),
        detail: evs,
      };
    },
  },
  {
    id: "cal-3",
    env: cal,
    title: "Clear the calendar",
    instruction: "Cancel every event on 2026-08-25 so the day is completely free.",
    difficulty: "medium",
    check: (s) => {
      const evs: string = String(s.events ?? "");
      return {
        passed: !evs.includes("2026-08-25"),
        detail: evs,
      };
    },
  },
  {
    id: "sh-1",
    env: sh,
    title: "Goodnight routine",
    instruction: "Turn off all the lights in the house.",
    difficulty: "easy",
    check: (s) => {
      const d: string = String(s.devices ?? "");
      const lights = d.split("\n").filter((l) => l.includes("light"));
      return {
        passed: lights.length === 3 && lights.every((l) => l.endsWith("off")),
        detail: d,
      };
    },
  },
  {
    id: "sh-2",
    env: sh,
    title: "Secure the house",
    instruction: "Lock the front door and set the thermostat to 20°C.",
    difficulty: "easy",
    check: (s) => {
      const d: string = String(s.devices ?? "");
      return {
        passed: d.includes("front_door (lock): locked") && d.includes("thermostat: 20°C"),
        detail: d,
      };
    },
  },
  {
    id: "sh-3",
    env: sh,
    title: "Energy-saving sweep",
    instruction:
      "Nobody is home. Turn off all lights, turn off the coffee maker, and lower the thermostat to 16°C. The front door must remain locked.",
    difficulty: "hard",
    check: (s) => {
      const d: string = String(s.devices ?? "");
      const lights = d.split("\n").filter((l) => l.includes("light"));
      return {
        passed:
          lights.length === 3 &&
          lights.every((l) => l.endsWith("off")) &&
          d.includes("coffee_maker (appliance): off") &&
          d.includes("thermostat: 16°C") &&
          d.includes("front_door (lock): locked"),
        detail: d,
      };
    },
  },
];

export function getTask(id: string): GymTask | undefined {
  return GYM_TASKS.find((t) => t.id === id);
}
