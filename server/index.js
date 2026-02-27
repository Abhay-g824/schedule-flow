import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import {
  callSchedulingModel,
  callConversationalSchedulingModel,
} from "./ollamaClient.js";

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const DB_PATH = path.join(process.cwd(), "data.db");

// Ensure DB file exists
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, "");
}

const db = new sqlite3.Database(DB_PATH);

// In-memory, per-user conversational history for the AI assistant.
// Map<userId, Array<{ role: "user" | "assistant", content: string }>>
const aiConversationHistory = new Map();

// In-memory, per-user pending proposal (decision gate).
// Map<userId, { type: "task" | "plan", payload: any, createdAt: string }>
const aiPendingProposal = new Map();

function normalizeUserText(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isConfirmationMessage(text) {
  const t = normalizeUserText(text);
  if (!t) return false;
  // Keep this strict to avoid accidental scheduling from longer messages.
  if (t.length > 40) return false;
  return /^(yes|y|yep|yeah|confirm|confirmed|ok|okay|looks good|sounds good|go ahead|do it|schedule it|proceed)( please)?[.!]?$/i.test(
    t
  );
}

function isRejectionMessage(text) {
  const t = normalizeUserText(text);
  if (!t) return false;
  // Also keep strict to avoid wiping proposals when the user is adjusting details.
  if (t.length > 60) return false;
  return /^(no|n|nope|cancel|stop|never mind|nevermind|not now|reject)( it)?[.!]?$/i.test(
    t
  );
}

function appendAiHistory(userId, userMessage, assistantMessage) {
  const existingHistory = aiConversationHistory.get(userId) || [];
  const updatedHistory = [
    ...existingHistory,
    { role: "user", content: String(userMessage ?? "").trim() },
    { role: "assistant", content: String(assistantMessage ?? "").trim() },
  ];
  const trimmedHistory =
    updatedHistory.length > 10
      ? updatedHistory.slice(updatedHistory.length - 10)
      : updatedHistory;
  aiConversationHistory.set(userId, trimmedHistory);
  return trimmedHistory;
}

function isIsoDateString(value) {
  if (!value || typeof value !== "string") return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

function textContainsDateOrTimeExpressions(text) {
  const t = normalizeUserText(text);
  if (!t) return false;

  const hasRelative =
    /\b(today|tomorrow)\b/i.test(t) ||
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(t);

  const hasNumericDate =
    /\b\d{4}-\d{1,2}-\d{1,2}\b/.test(t) || // 2026-02-27
    /\b\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})\b/.test(t); // 27/2/26, 27-02-2026

  const hasTime =
    /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i.test(t) || // 17:00, 5:00pm
    /\b\d{1,2}\s*(am|pm)\b/i.test(t); // 5pm, 10 am

  return hasRelative || hasNumericDate || hasTime;
}

function parseTimeFromText(text) {
  const raw = String(text ?? "");
  const t = raw.toLowerCase();

  // 17:00 or 5:00 pm
  let m = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?\b/i);
  if (m) {
    let hour = Number(m[1]);
    const minute = Number(m[2]);
    const ampm = m[3] ? String(m[3]).toLowerCase() : null;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (minute < 0 || minute > 59) return null;
    if (ampm) {
      if (hour < 1 || hour > 12) return null;
      if (ampm === "pm" && hour !== 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
    } else {
      if (hour < 0 || hour > 23) return null;
    }
    return { hour, minute };
  }

  // 5pm or 10 am
  m = t.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (m) {
    let hour = Number(m[1]);
    const minute = 0;
    const ampm = String(m[2]).toLowerCase();
    if (!Number.isFinite(hour)) return null;
    if (hour < 1 || hour > 12) return null;
    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  return null;
}

function parseDateFromText(text, now = new Date()) {
  const raw = String(text ?? "");
  const t = normalizeUserText(raw);
  if (!t) return null;

  if (/\btoday\b/i.test(t)) {
    return { kind: "absolute", date: new Date(now.getFullYear(), now.getMonth(), now.getDate()), explicitToday: true };
  }
  if (/\btomorrow\b/i.test(t)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + 1);
    return { kind: "absolute", date: d, explicitToday: false };
  }

  const weekdayMatch = t.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (weekdayMatch) {
    const target = weekdayMatch[1].toLowerCase();
    const map = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const targetDow = map[target];
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDow = base.getDay();
    let delta = targetDow - currentDow;
    if (delta < 0) delta += 7;
    // If user says "monday" and it's already monday, treat as today (delta 0).
    const d = new Date(base);
    d.setDate(d.getDate() + delta);
    return { kind: "absolute", date: d, explicitToday: false };
  }

  // ISO-like: 2026-02-27
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    if (y >= 1970 && mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
      return { kind: "absolute", date: new Date(y, mo - 1, da), explicitToday: false };
    }
  }

  // D/M/YY(YY) or D-M-YYYY etc. Assume D/M when ambiguous (common in this locale).
  m = t.match(/\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))\b/);
  if (m) {
    const d1 = Number(m[1]);
    const d2 = Number(m[2]);
    const yRaw = Number(m[3]);
    let year = yRaw;
    if (year < 100) year = 2000 + year; // 26 -> 2026
    let day = d1;
    let month = d2;

    // If clearly MM/DD (e.g. 2/27/2026), swap.
    if (d1 <= 12 && d2 > 12) {
      month = d1;
      day = d2;
    }

    if (year >= 1970 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { kind: "absolute", date: new Date(year, month - 1, day), explicitToday: false };
    }
  }

  return null;
}

function formatTimeRange(start, end) {
  const timeOpts = { hour: "numeric", minute: "2-digit" };
  const dateStr = start.toLocaleDateString();
  const startTime = start.toLocaleTimeString([], timeOpts);
  const endTime = end.toLocaleTimeString([], timeOpts);
  return { dateStr, startTime, endTime };
}

function tryUpdatePendingTaskProposalFromUserMessage(pending, userMessage, now = new Date()) {
  if (!pending || pending.type !== "task") return { ok: false };
  const payload = pending.payload || {};
  if (
    typeof payload.title !== "string" ||
    !payload.title.trim() ||
    !isIsoDateString(payload.suggested_start) ||
    !isIsoDateString(payload.suggested_end) ||
    !["low", "medium", "high"].includes(payload.priority)
  ) {
    return { ok: false };
  }

  if (!textContainsDateOrTimeExpressions(userMessage)) return { ok: false };

  const prevStart = new Date(payload.suggested_start);
  const prevEnd = new Date(payload.suggested_end);
  const durationMs = Math.max(30 * 60 * 1000, prevEnd.getTime() - prevStart.getTime() || 60 * 60 * 1000);

  const parsedTime = parseTimeFromText(userMessage);
  const parsedDate = parseDateFromText(userMessage, now);

  if (!parsedTime && !parsedDate) return { ok: false };

  let baseDate = parsedDate?.date
    ? new Date(parsedDate.date.getFullYear(), parsedDate.date.getMonth(), parsedDate.date.getDate())
    : new Date(prevStart.getFullYear(), prevStart.getMonth(), prevStart.getDate());

  const hour = parsedTime ? parsedTime.hour : prevStart.getHours();
  const minute = parsedTime ? parsedTime.minute : prevStart.getMinutes();

  let newStart = new Date(baseDate);
  newStart.setHours(hour, minute, 0, 0);

  // If user explicitly said "today" but the chosen time already passed, roll to tomorrow.
  if (parsedDate?.explicitToday && newStart.getTime() < now.getTime()) {
    const bumped = new Date(newStart);
    bumped.setDate(bumped.getDate() + 1);
    newStart = bumped;
  }

  const newEnd = new Date(newStart.getTime() + durationMs);

  const updatedPayload = {
    title: payload.title,
    suggested_start: newStart.toISOString(),
    suggested_end: newEnd.toISOString(),
    priority: payload.priority,
  };

  return { ok: true, updatedPayload, newStart, newEnd };
}

async function insertTaskForUser(userId, { title, start, end, priority }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const dueDate = start; // Use task start as due_date for compatibility.
  const timeSlotStart = start;
  const timeSlotEnd = end;

  await runQuery(
    "INSERT INTO tasks (id, user_id, title, description, priority, completed, due_date, created_at, color, reminder_time, time_slot_start, time_slot_end, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      userId,
      title,
      null,
      priority,
      0,
      dueDate,
      createdAt,
      null,
      null,
      timeSlotStart,
      timeSlotEnd,
      null,
    ]
  );

  return { id };
}

function buildDefaultSuggestedSlot(now = new Date()) {
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const setDefaultTime = (d) => {
    d.setSeconds(0, 0);
    d.setHours(isWeekend(d) ? 10 : 16, 0, 0, 0);
    return d;
  };

  let suggestedStart = setDefaultTime(new Date(now));
  if (now.getTime() > suggestedStart.getTime()) {
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    suggestedStart = setDefaultTime(nextDay);
  }

  const suggestedEnd = new Date(suggestedStart.getTime() + 60 * 60 * 1000);
  return { suggestedStart, suggestedEnd };
}

function looksLikeGreeting(text) {
  const t = normalizeUserText(text);
  if (!t) return false;
  return /^(hi|hello|hey|yo|good morning|good evening|good afternoon|howdy|hiya)\b/i.test(
    t
  );
}

function looksLikeLearningPlanRequest(text) {
  const t = normalizeUserText(text);
  return /\b(learn|learning|study|timetable|time table|schedule for learning|study plan|learning plan|gym|workout|work out|fitness|training|exercise|chest week|push pull legs|ppl|weekly workout|workout plan|gym plan)\b/i.test(
    t
  );
}

function looksLikeBareCreateTaskRequest(text) {
  const t = normalizeUserText(text);
  const words = t.split(" ").filter(Boolean);
  return (
    /^(create|add|schedule)\s+(a\s+)?task\b/i.test(t) &&
    words.length <= 4
  );
}

function looksLikeTopicOnlyTask(text) {
  const t = normalizeUserText(text);
  if (!t) return false;
  if (looksLikeLearningPlanRequest(t)) return false;
  if (/^(hi|hello|hey|good morning|good evening|good afternoon)\b/i.test(t)) {
    return false;
  }
  if (looksLikeBareCreateTaskRequest(t)) return false;

  const hasDateOrTimeHints =
    /\b(today|tomorrow|next|this|on|at|am|pm)\b/i.test(t) ||
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(t) ||
    /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/i.test(
      t
    ) ||
    /\d{1,2}:\d{2}/.test(t) ||
    /\b\d{1,2}\b/.test(t);

  if (hasDateOrTimeHints) return false;
  return t.length >= 6;
}

function withConfirmationPrompt(message) {
  const base = String(message ?? "").trim();
  const suffix = ` Reply "confirm" to schedule it, or tell me what to change.`;
  if (!base) return suffix.trim();
  if (/\bconfirm\b/i.test(base) || /reply\s+["']?confirm["']?/i.test(base)) {
    return base;
  }
  // If it already ends with a question, keep it but still include the explicit confirm keyword.
  if (/[?]\s*$/.test(base)) {
    return `${base}${suffix}`;
  }
  return `${base}${suffix}`;
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add onboarding fields if they don't exist
  db.run(`ALTER TABLE users ADD COLUMN role TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding role column:", err);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN age INTEGER`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding age column:", err);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN priority_task TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding priority_task column:", err);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding onboarding_completed column:", err);
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      completed INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Add missing columns if they don't exist
  db.run(`ALTER TABLE tasks ADD COLUMN color TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding color column:", err);
    }
  });
  db.run(`ALTER TABLE tasks ADD COLUMN reminder_time TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding reminder_time column:", err);
    }
  });
  db.run(`ALTER TABLE tasks ADD COLUMN time_slot_start TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding time_slot_start column:", err);
    }
  });
  db.run(`ALTER TABLE tasks ADD COLUMN time_slot_end TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding time_slot_end column:", err);
    }
  });
  db.run(`ALTER TABLE tasks ADD COLUMN category TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Error adding category column:", err);
    }
  });

  // Templates table
  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      category TEXT,
      time_slot_start TEXT,
      time_slot_end TEXT,
      color TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Missing token" });
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Invalid token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  try {
    const existing = await getQuery("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (existing) return res.status(400).json({ message: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await runQuery("INSERT INTO users (email, password_hash, onboarding_completed) VALUES (?, ?, 0)", [email.toLowerCase(), passwordHash]);
    const userId = result.lastID;
    const token = createToken(userId);
    res.json({ token, user: { id: userId, email: email.toLowerCase(), onboarding_completed: 0 } });
  } catch (err) {
    console.error("Signup error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  try {
    const user = await getQuery("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const token = createToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        onboarding_completed: user.onboarding_completed || 0
      }
    });
  } catch (err) {
    console.error("Login error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.post("/auth/forgot-password", async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ message: "Email and new password are required" });
  try {
    const user = await getQuery("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!user) return res.status(404).json({ message: "User not found" });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await runQuery("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("Forgot password error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.post("/auth/reset-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: "Current and new password are required" });
  try {
    const user = await getQuery("SELECT * FROM users WHERE id = ?", [req.userId]);
    if (!user) return res.status(404).json({ message: "User not found" });
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await runQuery("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, req.userId]);
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("Reset password error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.get("/tasks", authMiddleware, async (req, res) => {
  try {
    const rows = await allQuery(
      "SELECT * FROM tasks WHERE user_id = ? ORDER BY datetime(created_at) DESC",
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Get tasks error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.post("/tasks", authMiddleware, async (req, res) => {
  const { title, description = null, priority = "medium", dueDate = null, color = null, reminderTime = null, timeSlotStart = null, timeSlotEnd = null, category = null } = req.body;
  if (!title) return res.status(400).json({ message: "Title is required" });
  try {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await runQuery(
      "INSERT INTO tasks (id, user_id, title, description, priority, completed, due_date, created_at, color, reminder_time, time_slot_start, time_slot_end, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, req.userId, title, description, priority, 0, dueDate, createdAt, color, reminderTime, timeSlotStart, timeSlotEnd, category]
    );
    res.status(201).json({
      id,
      user_id: req.userId,
      title,
      description,
      priority,
      completed: 0,
      due_date: dueDate,
      created_at: createdAt,
      color,
      reminder_time: reminderTime,
      time_slot_start: timeSlotStart,
      time_slot_end: timeSlotEnd,
      category,
    });
  } catch (err) {
    console.error("Create task error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.patch("/tasks/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, completed, dueDate, color, reminderTime, timeSlotStart, timeSlotEnd, category } = req.body;
  try {
    const task = await getQuery("SELECT * FROM tasks WHERE id = ? AND user_id = ?", [id, req.userId]);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const newTitle = title ?? task.title;
    const newDescription = description ?? task.description;
    const newPriority = priority ?? task.priority;
    const newCompleted = typeof completed === "number" ? completed : task.completed;
    const newDueDate = dueDate === undefined ? task.due_date : dueDate;
    const newColor = color === undefined ? task.color : color;
    const newReminderTime = reminderTime === undefined ? task.reminder_time : reminderTime;
    const newTimeSlotStart = timeSlotStart === undefined ? task.time_slot_start : timeSlotStart;
    const newTimeSlotEnd = timeSlotEnd === undefined ? task.time_slot_end : timeSlotEnd;
    const newCategory = category === undefined ? task.category : category;

    await runQuery(
      "UPDATE tasks SET title = ?, description = ?, priority = ?, completed = ?, due_date = ?, color = ?, reminder_time = ?, time_slot_start = ?, time_slot_end = ?, category = ? WHERE id = ? AND user_id = ?",
      [newTitle, newDescription, newPriority, newCompleted, newDueDate, newColor, newReminderTime, newTimeSlotStart, newTimeSlotEnd, newCategory, id, req.userId]
    );

    res.json({
      ...task,
      title: newTitle,
      description: newDescription,
      priority: newPriority,
      completed: newCompleted,
      due_date: newDueDate,
      color: newColor,
      reminder_time: newReminderTime,
      time_slot_start: newTimeSlotStart,
      time_slot_end: newTimeSlotEnd,
      category: newCategory,
    });
  } catch (err) {
    console.error("Update task error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.delete("/tasks/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await runQuery("DELETE FROM tasks WHERE id = ? AND user_id = ?", [id, req.userId]);
    res.status(204).end();
  } catch (err) {
    console.error("Delete task error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.get("/user/profile", authMiddleware, async (req, res) => {
  try {
    const user = await getQuery("SELECT id, email, role, age, priority_task, onboarding_completed FROM users WHERE id = ?", [req.userId]);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      age: user.age,
      priority_tasks: user.priority_task ? JSON.parse(user.priority_task) : [],
      onboarding_completed: user.onboarding_completed || 0,
    });
  } catch (err) {
    console.error("Get user profile error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.patch("/user/profile", authMiddleware, async (req, res) => {
  const { email, role, age, priority_tasks } = req.body;

  try {
    // 1. Update basic info first
    if (email) {
      // Check if email taken by another user
      const existing = await getQuery("SELECT id FROM users WHERE email = ? AND id != ?", [email.toLowerCase(), req.userId]);
      if (existing) return res.status(400).json({ message: "Email already in use" });
      await runQuery("UPDATE users SET email = ? WHERE id = ?", [email.toLowerCase(), req.userId]);
    }

    // 2. Update optional profile fields
    const updates = [];
    const params = [];

    if (role) {
      updates.push("role = ?");
      params.push(role);
    }

    if (age) {
      updates.push("age = ?");
      params.push(age);
    }

    if (priority_tasks) {
      updates.push("priority_task = ?");
      params.push(JSON.stringify(priority_tasks));
    }

    if (updates.length > 0) {
      params.push(req.userId);
      await runQuery(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    }

    // 3. Fetch and return updated profile
    const user = await getQuery("SELECT id, email, role, age, priority_task, onboarding_completed FROM users WHERE id = ?", [req.userId]);
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      age: user.age,
      priority_tasks: user.priority_task ? JSON.parse(user.priority_task) : [],
      onboarding_completed: user.onboarding_completed,
    });
  } catch (err) {
    console.error("Update profile error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.patch("/user/onboarding", authMiddleware, async (req, res) => {
  const { role, age, priority_tasks } = req.body;
  if (!role || !age || !priority_tasks) {
    return res.status(400).json({ message: "Role, age, and priority_tasks are required" });
  }
  try {
    const priorityTaskJson = JSON.stringify(priority_tasks);
    await runQuery(
      "UPDATE users SET role = ?, age = ?, priority_task = ?, onboarding_completed = 1 WHERE id = ?",
      [role, age, priorityTaskJson, req.userId]
    );
    const user = await getQuery("SELECT id, email, role, age, priority_task, onboarding_completed FROM users WHERE id = ?", [req.userId]);
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      age: user.age,
      priority_tasks: user.priority_task ? JSON.parse(user.priority_task) : [],
      onboarding_completed: user.onboarding_completed,
    });
  } catch (err) {
    console.error("Update onboarding error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

// --------- AI scheduling endpoint (LLM JSON-only parser) ---------

/**
 * POST /ai/schedule/parse
 * Body: { prompt: string, context?: Array<{ role: "user" | "assistant", content: string }> }
 *
 * Responsibilities:
 * - Call local Ollama model via ollamaClient.
 * - Enforce STRICT JSON output with a small retry loop.
 * - Never perform date math here – only return structured fields.
 * - If the model fails, return { ok: false } so the frontend can
 *   fall back to the deterministic rule-based parser.
 */
app.post("/ai/schedule/parse", authMiddleware, async (req, res) => {
  const { prompt, context } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ ok: false, message: "prompt is required" });
  }

  try {
    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const raw = await callSchedulingModel(prompt, context);
      const parsed = tryParseSchedulingJson(raw);
      if (parsed.ok) {
        return res.json({
          ok: true,
          data: parsed.data,
        });
      }
      lastError = parsed.error;
    }

    console.error("LLM scheduling parse failed after retries:", lastError);
    return res.status(422).json({
      ok: false,
      message: "LLM output could not be parsed as valid scheduling JSON",
    });
  } catch (err) {
    console.error("LLM scheduling endpoint error:", err);
    return res.status(500).json({
      ok: false,
      message: "LLM scheduling endpoint error",
    });
  }
});

function tryParseSchedulingJson(raw) {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Empty LLM output" };
  }

  // Best-effort: trim and try to isolate a JSON object.
  const trimmed = raw.trim();
  let candidate = trimmed;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidate = trimmed.slice(firstBrace, lastBrace + 1);
  }

  try {
    const json = JSON.parse(candidate);
    const validated = validateSchedulingShape(json);
    if (!validated.ok) {
      return { ok: false, error: validated.error || "Invalid shape" };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: err.message || "JSON parse error" };
  }
}

function validateSchedulingShape(obj) {
  if (typeof obj !== "object" || obj === null) {
    return { ok: false, error: "Root must be an object" };
  }

  const intents = ["create_task", "schedule_only", "reschedule", "multi_schedule"];
  if (!intents.includes(obj.intent)) {
    return { ok: false, error: "Invalid or missing intent" };
  }

  if (!Array.isArray(obj.tasks)) {
    return { ok: false, error: "tasks must be an array" };
  }

  for (const task of obj.tasks) {
    if (typeof task !== "object" || task === null) {
      return { ok: false, error: "task must be object" };
    }
    if (typeof task.taskTitle !== "string" || !task.taskTitle.trim()) {
      return { ok: false, error: "taskTitle must be non-empty string" };
    }

    const priorities = ["high", "medium", "low"];
    if (!priorities.includes(task.priority)) {
      return { ok: false, error: "priority must be high|medium|low" };
    }

    if (
      task.dateExpression !== null &&
      typeof task.dateExpression !== "string"
    ) {
      return { ok: false, error: "dateExpression must be string|null" };
    }

    if (task.month !== null && typeof task.month !== "number") {
      return { ok: false, error: "month must be number|null" };
    }

    if (
      task.weekday !== null &&
      typeof task.weekday !== "string"
    ) {
      return { ok: false, error: "weekday must be string|null" };
    }

    if (
      task.weekdayOrdinal !== null &&
      typeof task.weekdayOrdinal !== "number"
    ) {
      return { ok: false, error: "weekdayOrdinal must be number|null" };
    }

    if (task.time !== null && typeof task.time !== "string") {
      return { ok: false, error: "time must be string|null" };
    }
  }

  if (typeof obj.requiresTimeConfirmation !== "boolean") {
    return { ok: false, error: "requiresTimeConfirmation must be boolean" };
  }
  if (typeof obj.requiresClarification !== "boolean") {
    return { ok: false, error: "requiresClarification must be boolean" };
  }

  return { ok: true };
}
// --------- Conversational AI scheduling assistant ---------

/**
 * POST /ai/schedule
 * Body: { message: string }
 *
 * Responsibilities:
 * - Maintain short in-memory conversation history per user session.
 * - Call local Ollama (gemma:2b) to get STRICT JSON with:
 *     {
 *       "assistant_message": string,
 *       "action": {
 *         "type": "create_task" | "clarify" | "none",
 *         "payload": { ... }
 *       }
 *     }
 * - Safely parse and validate the JSON.
 * - When action.type === "create_task", create a real task using the
 *   existing tasks table schema.
 * - Only confirm scheduling to the user after successful creation.
 */
app.post("/ai/schedule", authMiddleware, async (req, res) => {
  const { message } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      success: false,
      error: "message is required",
    });
  }

  const userId = req.userId;
  const trimmedUserMessage = message.trim();

  // Decision gate: if there's a pending proposal, only create on explicit confirmation.
  const pending = aiPendingProposal.get(userId);
  if (pending) {
    if (isConfirmationMessage(trimmedUserMessage)) {
      try {
        const payload = pending.payload || {};
        const tasks =
          pending.type === "plan"
            ? Array.isArray(payload.tasks)
              ? payload.tasks
              : []
            : [
                {
                  title: payload.title,
                  start: payload.suggested_start,
                  end: payload.suggested_end,
                  priority: payload.priority,
                },
              ];

        const validTasks = tasks.filter(
          (t) =>
            t &&
            typeof t.title === "string" &&
            t.title.trim() &&
            isIsoDateString(t.start) &&
            isIsoDateString(t.end) &&
            ["low", "medium", "high"].includes(t.priority)
        );

        if (validTasks.length === 0) {
          aiPendingProposal.delete(userId);
          const msg =
            "I don't have a valid pending proposal to schedule anymore. What would you like to schedule (title, date, and time)?";
          appendAiHistory(userId, trimmedUserMessage, msg);
          return res.json({ success: false, message: msg });
        }

        for (const t of validTasks) {
          await insertTaskForUser(userId, t);
        }

        aiPendingProposal.delete(userId);

        const confirmationMessage =
          validTasks.length === 1
            ? `Done — scheduled "${validTasks[0].title}".`
            : `Done — scheduled ${validTasks.length} tasks.`;

        appendAiHistory(userId, trimmedUserMessage, confirmationMessage);
        return res.json({
          success: true,
          message: confirmationMessage,
        });
      } catch (err) {
        console.error("Confirm proposal -> create task(s) error:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to create task(s) from the confirmed proposal",
        });
      }
    }

    if (isRejectionMessage(trimmedUserMessage)) {
      aiPendingProposal.delete(userId);
      const msg =
        "Okay — I won't schedule that. What would you like to schedule instead (title, date, and time)?";
      appendAiHistory(userId, trimmedUserMessage, msg);
      return res.json({ success: false, message: msg });
    }

    // If the user greets while a proposal is pending, keep context and ask for confirmation or changes.
    if (looksLikeGreeting(trimmedUserMessage)) {
      if (pending.type === "task") {
        const payload = pending.payload || {};
        if (
          payload &&
          typeof payload.title === "string" &&
          payload.title.trim() &&
          isIsoDateString(payload.suggested_start) &&
          isIsoDateString(payload.suggested_end)
        ) {
          const start = new Date(payload.suggested_start);
          const end = new Date(payload.suggested_end);
          const { dateStr, startTime, endTime } = formatTimeRange(start, end);
          const msg = `Hi! You're currently scheduling "${payload.title}" on ${dateStr} at ${startTime}–${endTime}. Reply "confirm" to schedule it, or tell me what to change.`;
          appendAiHistory(userId, trimmedUserMessage, msg);
          return res.json({
            success: false,
            message: msg,
            requires_confirmation: true,
          });
        }
      }

      if (pending.type === "plan") {
        const payload = pending.payload || {};
        const planTitle =
          payload && typeof payload.plan_title === "string" && payload.plan_title.trim()
            ? payload.plan_title.trim()
            : "your weekly plan";
        const msg = `Hi! I have a pending proposal for "${planTitle}". Reply "confirm" to schedule it, or tell me what you'd like to adjust (days/times).`;
        appendAiHistory(userId, trimmedUserMessage, msg);
        return res.json({
          success: false,
          message: msg,
          requires_confirmation: true,
        });
      }
    }

    // If user is modifying date/time, update the pending proposal without calling the model.
    const updated = tryUpdatePendingTaskProposalFromUserMessage(
      pending,
      trimmedUserMessage,
      new Date()
    );
    if (updated.ok) {
      aiPendingProposal.set(userId, {
        type: "task",
        payload: updated.updatedPayload,
        createdAt: new Date().toISOString(),
      });

      const { dateStr, startTime, endTime } = formatTimeRange(
        updated.newStart,
        updated.newEnd
      );
      const msg = `I can schedule "${updated.updatedPayload.title}" on ${dateStr} at ${startTime}–${endTime}. Reply "confirm" to schedule it, or tell me what to change.`;
      appendAiHistory(userId, trimmedUserMessage, msg);
      return res.json({
        success: false,
        message: msg,
        requires_confirmation: true,
      });
    }

    // If it's unrelated (neither confirm/reject nor a date/time modification), drop the old pending proposal.
    aiPendingProposal.delete(userId);
  }

  // Handle greetings without calling the model (prevents JSON/validation loops).
  if (looksLikeGreeting(trimmedUserMessage)) {
    const msg =
      `Hi! What would you like to schedule? ` +
      `You can say something like "project meeting tomorrow at 5pm" or "plan a chest week for this week".`;
    appendAiHistory(userId, trimmedUserMessage, msg);
    return res.json({ success: false, message: msg });
  }

  // Lightweight deterministic behavior for common cases (reduces model mistakes).
  if (looksLikeBareCreateTaskRequest(trimmedUserMessage)) {
    const msg =
      "Sure — what should I create, and when? Please share the task title plus the date and time (or a time window).";
    appendAiHistory(userId, trimmedUserMessage, msg);
    return res.json({ success: false, message: msg });
  }

  // If the user only provides a topic (no date/time), propose a reasonable default slot.
  if (looksLikeTopicOnlyTask(trimmedUserMessage)) {
    const { suggestedStart, suggestedEnd } = buildDefaultSuggestedSlot(new Date());
    const payload = {
      title: trimmedUserMessage,
      suggested_start: suggestedStart.toISOString(),
      suggested_end: suggestedEnd.toISOString(),
      priority: "medium",
    };

    aiPendingProposal.set(userId, {
      type: "task",
      payload,
      createdAt: new Date().toISOString(),
    });

    const msg =
      `I can schedule "${payload.title}". I suggest ` +
      `${suggestedStart.toLocaleString()}–${suggestedEnd.toLocaleTimeString()}. ` +
      `Reply "confirm" to schedule it, or tell me a different date/time.`;

    appendAiHistory(userId, trimmedUserMessage, msg);
    return res.json({ success: false, message: msg, requires_confirmation: true });
  }

  // Get the existing history for this user and take the last 5 turns.
  const existingHistory = aiConversationHistory.get(userId) || [];
  const shortHistory =
    existingHistory.length > 3
      ? existingHistory.slice(existingHistory.length - 3)
      : existingHistory;

  // Send short history; the model call will append the current user message.
  const contextForModel = looksLikeLearningPlanRequest(trimmedUserMessage)
    ? []
    : [...shortHistory];

  let raw;
  try {
    raw = await callConversationalSchedulingModel(message, contextForModel);
  } catch (err) {
    console.error("Ollama conversational scheduling error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to contact AI assistant",
    });
  }

  let parsed = null;

  try {
    const rawString =
      typeof raw === "string" ? raw.trim() : JSON.stringify(raw ?? {}).trim();
    const firstBrace = rawString.indexOf("{");
    const lastBrace = rawString.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = rawString.slice(firstBrace, lastBrace + 1);
      parsed = JSON.parse(candidate);
    }
  } catch (err) {
    console.error("LLM JSON parse failed:", err);
  }

  if (parsed === null) {
    return res.json({
      success: false,
      message:
        "I didn’t fully understand that. Could you rephrase with a clear task, date, and time?",
    });
  }

  const validation = validateConversationalAiShape(parsed);
  if (!validation.ok) {
    console.error("AI JSON failed shape validation:", validation.error);
    return res.json({
      success: false,
      message: "I need a bit more clarity. Please provide task title, date, and time.",
    });
  }

  const assistantMessage = parsed.assistant_message;
  const action = parsed.action || { type: "none", payload: {} };

  // Update in-memory history only after we have a valid assistant message.
  appendAiHistory(userId, trimmedUserMessage, assistantMessage);

  // Decision gate enforcement: never schedule immediately from the model.
  // If the model tried to return create_task, we treat it as a proposal.
  if (action.type === "create_task") {
    const payload = action.payload || {};
    aiPendingProposal.set(userId, {
      type: "task",
      payload: {
        title: payload.title,
        suggested_start: payload.start,
        suggested_end: payload.end,
        priority: payload.priority,
      },
      createdAt: new Date().toISOString(),
    });

    const msg =
      assistantMessage.trim().length > 0
        ? `${assistantMessage.trim()} Reply "confirm" to schedule it, or tell me what to change.`
        : `I can schedule that. Reply "confirm" to schedule it, or tell me what to change.`;

    return res.json({
      success: false,
      message: msg,
      requires_confirmation: true,
    });
  }

  if (action.type === "clarify") {
    return res.json({
      success: false,
      clarification: assistantMessage,
      message: assistantMessage,
    });
  }

  if (action.type === "propose_task") {
    const payload = action.payload || {};
    aiPendingProposal.set(userId, {
      type: "task",
      payload,
      createdAt: new Date().toISOString(),
    });
    return res.json({
      success: false,
      message: withConfirmationPrompt(assistantMessage),
      requires_confirmation: true,
    });
  }

  if (action.type === "propose_plan") {
    const payload = action.payload || {};
    aiPendingProposal.set(userId, {
      type: "plan",
      payload,
      createdAt: new Date().toISOString(),
    });
    return res.json({
      success: false,
      message: withConfirmationPrompt(assistantMessage),
      requires_confirmation: true,
    });
  }

  // action.type === "none" – pure conversational reply.
  return res.json({
    success: false,
    message: assistantMessage,
  });
});

function validateConversationalAiShape(obj) {
  if (typeof obj !== "object" || obj === null) {
    return { ok: false, error: "Root must be an object" };
  }

  if (typeof obj.assistant_message !== "string") {
    return { ok: false, error: "assistant_message must be a string" };
  }

  if (typeof obj.action !== "object" || obj.action === null) {
    return { ok: false, error: "action must be an object" };
  }

  const type = obj.action.type;
  const allowed = [
    "create_task", // backwards compatibility (server still enforces decision gate)
    "propose_task",
    "propose_plan",
    "clarify",
    "none",
  ];
  if (!allowed.includes(type)) {
    return {
      ok: false,
      error: "action.type must be propose_task|propose_plan|clarify|none (create_task allowed for compatibility)",
    };
  }

  // Payload validation by action type.
  if (type === "create_task") {
    const payload = obj.action.payload;
    if (typeof payload !== "object" || payload === null) {
      return {
        ok: false,
        error: "action.payload must be an object for create_task",
      };
    }

    if (typeof payload.title !== "string" || !payload.title.trim()) {
      return { ok: false, error: "payload.title must be a non-empty string" };
    }
    if (typeof payload.start !== "string" || !payload.start.trim()) {
      return { ok: false, error: "payload.start must be an ISO date string" };
    }
    if (typeof payload.end !== "string" || !payload.end.trim()) {
      return { ok: false, error: "payload.end must be an ISO date string" };
    }
    if (!["low", "medium", "high"].includes(payload.priority)) {
      return {
        ok: false,
        error: "payload.priority must be low|medium|high",
      };
    }
  }

  if (type === "propose_task") {
    const payload = obj.action.payload;
    if (typeof payload !== "object" || payload === null) {
      return { ok: false, error: "action.payload must be an object for propose_task" };
    }
    if (typeof payload.title !== "string" || !payload.title.trim()) {
      return { ok: false, error: "payload.title must be a non-empty string" };
    }
    if (typeof payload.suggested_start !== "string" || !payload.suggested_start.trim()) {
      return { ok: false, error: "payload.suggested_start must be an ISO date string" };
    }
    if (typeof payload.suggested_end !== "string" || !payload.suggested_end.trim()) {
      return { ok: false, error: "payload.suggested_end must be an ISO date string" };
    }
    if (!["low", "medium", "high"].includes(payload.priority)) {
      return { ok: false, error: "payload.priority must be low|medium|high" };
    }
  }

  if (type === "propose_plan") {
    const payload = obj.action.payload;
    if (typeof payload !== "object" || payload === null) {
      return { ok: false, error: "action.payload must be an object for propose_plan" };
    }
    if (typeof payload.plan_title !== "string" || !payload.plan_title.trim()) {
      return { ok: false, error: "payload.plan_title must be a non-empty string" };
    }
    if (!Array.isArray(payload.tasks) || payload.tasks.length === 0) {
      return { ok: false, error: "payload.tasks must be a non-empty array" };
    }
    for (const t of payload.tasks) {
      if (typeof t !== "object" || t === null) {
        return { ok: false, error: "each task in payload.tasks must be an object" };
      }
      if (typeof t.title !== "string" || !t.title.trim()) {
        return { ok: false, error: "plan task.title must be a non-empty string" };
      }
      if (typeof t.start !== "string" || !t.start.trim()) {
        return { ok: false, error: "plan task.start must be an ISO date string" };
      }
      if (typeof t.end !== "string" || !t.end.trim()) {
        return { ok: false, error: "plan task.end must be an ISO date string" };
      }
      if (!["low", "medium", "high"].includes(t.priority)) {
        return { ok: false, error: "plan task.priority must be low|medium|high" };
      }
    }
  }

  return { ok: true };
}

// Template endpoints
app.get("/templates", authMiddleware, async (req, res) => {
  try {
    const rows = await allQuery(
      "SELECT * FROM templates WHERE user_id = ? ORDER BY datetime(created_at) DESC",
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Get templates error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.post("/templates", authMiddleware, async (req, res) => {
  const { title, description = null, priority = "medium", category = null, timeSlotStart = null, timeSlotEnd = null, color = null } = req.body;
  if (!title) return res.status(400).json({ message: "Title is required" });
  try {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await runQuery(
      "INSERT INTO templates (id, user_id, title, description, priority, category, time_slot_start, time_slot_end, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, req.userId, title, description, priority, category, timeSlotStart, timeSlotEnd, color, createdAt]
    );
    res.status(201).json({
      id,
      user_id: req.userId,
      title,
      description,
      priority,
      category,
      time_slot_start: timeSlotStart,
      time_slot_end: timeSlotEnd,
      color,
      created_at: createdAt,
    });
  } catch (err) {
    console.error("Create template error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.delete("/templates/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await runQuery("DELETE FROM templates WHERE id = ? AND user_id = ?", [id, req.userId]);
    res.status(204).end();
  } catch (err) {
    console.error("Delete template error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.post("/templates/:id/create-task", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { dueDate = null } = req.body;
  try {
    const template = await getQuery("SELECT * FROM templates WHERE id = ? AND user_id = ?", [id, req.userId]);
    if (!template) return res.status(404).json({ message: "Template not found" });

    const taskId = randomUUID();
    const createdAt = new Date().toISOString();
    await runQuery(
      "INSERT INTO tasks (id, user_id, title, description, priority, completed, due_date, created_at, color, time_slot_start, time_slot_end, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [taskId, req.userId, template.title, template.description, template.priority, 0, dueDate, createdAt, template.color, template.time_slot_start, template.time_slot_end, template.category]
    );

    res.status(201).json({
      id: taskId,
      user_id: req.userId,
      title: template.title,
      description: template.description,
      priority: template.priority,
      completed: 0,
      due_date: dueDate,
      created_at: createdAt,
      color: template.color,
      time_slot_start: template.time_slot_start,
      time_slot_end: template.time_slot_end,
      category: template.category,
    });
  } catch (err) {
    console.error("Create task from template error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

