import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { clinicDay } from "./reducer";
import { getBackend, staffPinOk } from "./server-store";

// Staff accounts: each person signs in with their own username and PIN, made by an administrator (System configuration →
// Users). Admins can do everything, including users and System configuration (no configuration PIN needed); staff use
// the front desk and stations. Until the first administrator is made, the old shared staff PIN (QUEUE_STAFF_PIN) works.
// A signed-in screen sends "session:<token>" in the same x-queue-pin header the staff PIN used.

export type Role = "admin" | "staff";
export type User = { id: string; name: string; username: string; role: Role; active: boolean; pin: { salt: string; hash: string }; createdAt: number; lastSignIn: number | null };
export type PublicUser = Omit<User, "pin">;
type Session = { token: string; userId: string; createdAt: number; expiresAt: number };
type Store = { users: User[]; sessions: Session[] };
export type Activity = { at: number; user: string; action: string; label?: string };

const STORE = "staff-users";
const ACTIVITY = "staff-activity";
const KEEP_ACTIVITY = 500;
const LONG = 90 * 86400000;
const SHORT = 12 * 3600000;
export const SESSION_PREFIX = "session:";

const shared = globalThis as typeof globalThis & { __thscUsers?: { store: Store | null; changing: Promise<unknown>; failures: Map<string, { count: number; until: number }> } };
const memory = (shared.__thscUsers ??= { store: null, changing: Promise.resolve(), failures: new Map() });

async function load(): Promise<Store> {
  if (!memory.store) {
    const saved = await getBackend()?.loadData<Store>(STORE);
    memory.store = { users: Array.isArray(saved?.users) ? saved.users : [], sessions: Array.isArray(saved?.sessions) ? saved.sessions : [] };
  }
  return memory.store;
}

/** Changes the accounts one at a time and saves them. */
function change<T>(edit: (store: Store) => T): Promise<T> {
  const task = memory.changing.then(async () => {
    const store = await load();
    const result = edit(store);
    store.sessions = store.sessions.filter((session) => session.expiresAt > Date.now() && store.users.some((user) => user.id === session.userId && user.active));
    await getBackend()?.saveData(STORE, store);
    return result;
  });
  memory.changing = task.catch(() => undefined);
  return task;
}

const hashPin = (pin: string, salt = randomBytes(16).toString("hex")) => ({ salt, hash: scryptSync(pin, salt, 32).toString("hex") });
const pinMatches = (pin: string, saved: User["pin"]) => {
  const given = scryptSync(pin, saved.salt, 32);
  const stored = Buffer.from(saved.hash, "hex");
  return stored.length === given.length && timingSafeEqual(stored, given);
};
const publicUser = (user: User): PublicUser => ({ id: user.id, name: user.name, username: user.username, role: user.role, active: user.active, createdAt: user.createdAt, lastSignIn: user.lastSignIn });
const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const usernameOf = (value: unknown) => clean(value, 30).toLowerCase();

/** Checks a new user's fields; returns an error to show, or null. */
function problem(name: string, username: string, pin: string | null, users: User[], except = ""): string | null {
  if (!name) return "Enter the person's name.";
  if (!/^[a-z0-9._-]{2,30}$/.test(username)) return "The username must be 2 to 30 letters or numbers (no spaces).";
  if (users.some((user) => user.username === username && user.id !== except)) return `The username ${username} is already used.`;
  if (pin !== null && !/^\d{4,8}$/.test(pin)) return "The PIN must be 4 to 8 digits.";
  return null;
}

/** Whether staff sign in with their own accounts (there is an active administrator). */
export async function usersOn() {
  return (await load()).users.some((user) => user.active && user.role === "admin");
}

/**
 * Who is asking: a signed-in user, or (only while no administrator is set up) anyone with the old shared staff PIN.
 * usersOn says whether staff accounts are in use.
 */
export async function staffOf(request: Request): Promise<{ staff: boolean; user: PublicUser | null; usersOn: boolean }> {
  const user = await userOf(request);
  const on = await usersOn();
  return { staff: Boolean(user) || (!on && staffPinOk(request)), user, usersOn: on };
}
export const isStaff = async (request: Request) => (await staffOf(request)).staff;

/** The signed-in user of a request ("session:<token>" in x-queue-pin), or null. */
export async function userOf(request: Request): Promise<PublicUser | null> {
  const given = request.headers.get("x-queue-pin") ?? "";
  if (!given.startsWith(SESSION_PREFIX)) return null;
  const token = given.slice(SESSION_PREFIX.length);
  const store = await load();
  const session = store.sessions.find((item) => item.token === token && item.expiresAt > Date.now());
  const user = session && store.users.find((item) => item.id === session.userId && item.active);
  return user ? publicUser(user) : null;
}

/** Signs a person in: a new session token, or an error (too many wrong PINs locks that username for 5 minutes). */
export async function signIn(usernameInput: unknown, pinInput: unknown, remember: boolean): Promise<{ token: string; user: PublicUser } | { error: string }> {
  const username = usernameOf(usernameInput);
  const pin = String(pinInput ?? "").trim();
  const failed = memory.failures.get(username);
  if (failed && failed.until > Date.now()) return { error: "Too many wrong PINs. Wait 5 minutes, or ask the administrator to reset the PIN." };
  const user = (await load()).users.find((item) => item.username === username);
  if (!user || !user.active || !/^\d{4,8}$/.test(pin) || !pinMatches(pin, user.pin)) {
    const count = (failed && failed.until <= Date.now() && failed.count >= 5 ? 0 : failed?.count ?? 0) + 1;
    memory.failures.set(username, { count, until: count >= 5 ? Date.now() + 5 * 60000 : 0 });
    return { error: user && !user.active ? "This account is disabled. Ask the administrator." : "The username or PIN is not right." };
  }
  memory.failures.delete(username);
  const token = randomBytes(24).toString("hex");
  const now = Date.now();
  await change((store) => {
    store.sessions.push({ token, userId: user.id, createdAt: now, expiresAt: now + (remember ? LONG : SHORT) });
    const saved = store.users.find((item) => item.id === user.id);
    if (saved) saved.lastSignIn = now;
  });
  return { token, user: publicUser({ ...user, lastSignIn: now }) };
}

export function signOut(request: Request) {
  const token = (request.headers.get("x-queue-pin") ?? "").slice(SESSION_PREFIX.length);
  return change((store) => { store.sessions = store.sessions.filter((session) => session.token !== token); });
}

export async function listUsers(): Promise<PublicUser[]> {
  return (await load()).users.map(publicUser);
}

/** Makes the first administrator (only while there is none). */
export async function setupAdmin(input: { name?: unknown; username?: unknown; pin?: unknown }): Promise<{ error: string } | { ok: true }> {
  return change((store) => {
    if (store.users.some((user) => user.active && user.role === "admin")) return { error: "The administrator is already set up. Sign in instead." };
    return addTo(store, { ...input, role: "admin" });
  });
}

function addTo(store: Store, input: { name?: unknown; username?: unknown; pin?: unknown; role?: unknown }): { error: string } | { ok: true } {
  const name = clean(input.name, 60);
  const username = usernameOf(input.username);
  const pin = String(input.pin ?? "").trim();
  const error = problem(name, username, pin, store.users);
  if (error) return { error };
  store.users.push({ id: randomBytes(8).toString("hex"), name, username, role: input.role === "admin" ? "admin" : "staff", active: true, pin: hashPin(pin), createdAt: Date.now(), lastSignIn: null });
  return { ok: true };
}

const lastAdmin = (store: Store, id: string) => !store.users.some((user) => user.id !== id && user.active && user.role === "admin");

/** An administrator's change to the accounts. */
export function manageUsers(action: { type?: unknown; id?: unknown; name?: unknown; username?: unknown; pin?: unknown; role?: unknown; active?: unknown }): Promise<{ error: string } | { ok: true }> {
  return change((store) => {
    if (action.type === "add") return addTo(store, action);
    const user = store.users.find((item) => item.id === action.id);
    if (!user) return { error: "That user was not found." };
    if (action.type === "resetPin") {
      const pin = String(action.pin ?? "").trim();
      if (!/^\d{4,8}$/.test(pin)) return { error: "The PIN must be 4 to 8 digits." };
      user.pin = hashPin(pin);
      store.sessions = store.sessions.filter((session) => session.userId !== user.id);
      memory.failures.delete(user.username);
      return { ok: true };
    }
    if (action.type === "update") {
      const role: Role = action.role === "admin" ? "admin" : action.role === "staff" ? "staff" : user.role;
      const active = typeof action.active === "boolean" ? action.active : user.active;
      if (user.role === "admin" && user.active && (role !== "admin" || !active) && lastAdmin(store, user.id)) return { error: "Keep at least one active administrator." };
      const name = action.name === undefined ? user.name : clean(action.name, 60);
      if (!name) return { error: "Enter the person's name." };
      Object.assign(user, { role, active, name });
      if (!active) store.sessions = store.sessions.filter((session) => session.userId !== user.id);
      return { ok: true };
    }
    if (action.type === "remove") {
      if (user.role === "admin" && user.active && lastAdmin(store, user.id)) return { error: "Keep at least one active administrator." };
      store.users = store.users.filter((item) => item.id !== user.id);
      return { ok: true };
    }
    return { error: "Unknown change." };
  });
}

// What each signed-in person did today, for System configuration → Users.
const activityKey = (now: number) => `${ACTIVITY}-${clinicDay(now)}`;
export async function logActivity(entry: Activity) {
  const backend = getBackend();
  if (!backend) return;
  memory.changing = memory.changing.then(async () => {
    const key = activityKey(entry.at);
    const list = (await backend.loadData<Activity[]>(key)) ?? [];
    await backend.saveData(key, [...list, entry].slice(-KEEP_ACTIVITY));
  }).catch(() => undefined);
}
export async function todaysActivity(): Promise<Activity[]> {
  return (await getBackend()?.loadData<Activity[]>(activityKey(Date.now()))) ?? [];
}
