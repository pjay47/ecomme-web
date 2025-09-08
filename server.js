
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this";

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

const DB_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DB_DIR, "users.json");
const ITEMS_FILE = path.join(DB_DIR, "items.json");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

// AUTH MIDDLEWARE
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---------- AUTH ROUTES ----------
app.post("/api/auth/signup", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, password required" });
  }
  const db = readJSON(USERS_FILE);
  const exists = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return res.status(409).json({ error: "Email already registered" });
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const newUser = { id: uuidv4(), name, email, passwordHash, cart: [] };
  db.users.push(newUser);
  writeJSON(USERS_FILE, db);
  const token = jwt.sign({ id: newUser.id, email: newUser.email, name: newUser.name }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email, password required" });
  const db = readJSON(USERS_FILE);
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// ---------- ITEMS CRUD + FILTERS ----------
// GET with filters: ?q=&category=&minPrice=&maxPrice=
app.get("/api/items", (req, res) => {
  const { q, category, minPrice, maxPrice } = req.query;
  const db = readJSON(ITEMS_FILE);
  let items = db.items;
  if (q) {
    const needle = String(q).toLowerCase();
    items = items.filter(i => i.title.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle));
  }
  if (category) {
    items = items.filter(i => i.category.toLowerCase() === String(category).toLowerCase());
  }
  if (minPrice) {
    const min = Number(minPrice);
    if (!Number.isNaN(min)) items = items.filter(i => i.price >= min);
  }
  if (maxPrice) {
    const max = Number(maxPrice);
    if (!Number.isNaN(max)) items = items.filter(i => i.price <= max);
  }
  res.json({ items });
});

app.post("/api/items", auth, (req, res) => {
  const { title, price, category, image, description } = req.body || {};
  if (!title || price == null || !category) {
    return res.status(400).json({ error: "title, price, category are required" });
  }
  const db = readJSON(ITEMS_FILE);
  const newItem = { id: uuidv4(), title, price: Number(price), category, image: image || "", description: description || "" };
  db.items.push(newItem);
  writeJSON(ITEMS_FILE, db);
  res.status(201).json(newItem);
});

app.put("/api/items/:id", auth, (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const db = readJSON(ITEMS_FILE);
  const idx = db.items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: "Item not found" });
  db.items[idx] = { ...db.items[idx], ...payload, id };
  writeJSON(ITEMS_FILE, db);
  res.json(db.items[idx]);
});

app.delete("/api/items/:id", auth, (req, res) => {
  const { id } = req.params;
  const db = readJSON(ITEMS_FILE);
  const idx = db.items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: "Item not found" });
  const removed = db.items.splice(idx, 1)[0];
  writeJSON(ITEMS_FILE, db);
  res.json(removed);
});

// ---------- CART (PERSISTENT PER USER) ----------
app.get("/api/cart", auth, (req, res) => {
  const users = readJSON(USERS_FILE).users;
  const me = users.find(u => u.id === req.user.id);
  if (!me) return res.status(404).json({ error: "User not found" });
  res.json({ cart: me.cart || [] });
});

app.post("/api/cart/add", auth, (req, res) => {
  const { itemId, qty } = req.body || {};
  const quantity = Math.max(1, Number(qty) || 1);
  const usersDb = readJSON(USERS_FILE);
  const me = usersDb.users.find(u => u.id === req.user.id);
  if (!me) return res.status(404).json({ error: "User not found" });
  const itemsDb = readJSON(ITEMS_FILE).items;
  const item = itemsDb.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });
  me.cart = me.cart || [];
  const existing = me.cart.find(ci => ci.item.id === itemId);
  if (existing) {
    existing.qty += quantity;
  } else {
    me.cart.push({ item, qty: quantity });
  }
  writeJSON(USERS_FILE, { users: usersDb.users });
  res.json({ cart: me.cart });
});

app.post("/api/cart/remove", auth, (req, res) => {
  const { itemId } = req.body || {};
  const usersDb = readJSON(USERS_FILE);
  const me = usersDb.users.find(u => u.id === req.user.id);
  if (!me) return res.status(404).json({ error: "User not found" });
  me.cart = (me.cart || []).filter(ci => ci.item.id !== itemId);
  writeJSON(USERS_FILE, { users: usersDb.users });
  res.json({ cart: me.cart });
});

// Serve SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
