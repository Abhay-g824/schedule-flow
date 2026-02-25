import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const DB_PATH = path.join(process.cwd(), "data.db");

// Ensure DB file exists
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, "");
}

const db = new sqlite3.Database(DB_PATH);

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

