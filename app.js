import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "INSERISCI_FIREBASE_API_KEY",
  authDomain: "INSERISCI_PROJECT_ID.firebaseapp.com",
  projectId: "INSERISCI_PROJECT_ID",
  storageBucket: "INSERISCI_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "INSERISCI_MESSAGING_SENDER_ID",
  appId: "INSERISCI_FIREBASE_APP_ID"
};

const BRAND_NAME = "Brik";
const AUTH_EMAIL_DOMAIN = "brik.local";
const TABLES = Array.from({ length: 24 }, (_, index) => index + 1);
const STATUS_LABELS = {
  new: "Nuova",
  preparing: "In preparazione",
  ready: "Pronta",
  served: "Servita"
};

const fallbackMenu = [
  { id: "espresso", name: "Espresso", category: "Bar", price: 1.2, active: true },
  { id: "cappuccino", name: "Cappuccino", category: "Bar", price: 1.8, active: true },
  { id: "spritz", name: "Spritz", category: "Bar", price: 5.5, active: true },
  { id: "acqua", name: "Acqua 0,75", category: "Bevande", price: 2.2, active: true },
  { id: "cola", name: "Cola", category: "Bevande", price: 3, active: true },
  { id: "margherita", name: "Pizza Margherita", category: "Cucina", price: 7.5, active: true },
  { id: "diavola", name: "Pizza Diavola", category: "Cucina", price: 9, active: true },
  { id: "tagliere", name: "Tagliere misto", category: "Cucina", price: 12, active: true },
  { id: "tiramisu", name: "Tiramisu", category: "Dolci", price: 5, active: true }
];

const els = {
  loginView: document.querySelector("#loginView"),
  mainView: document.querySelector("#mainView"),
  loginForm: document.querySelector("#loginForm"),
  usernameInput: document.querySelector("#usernameInput"),
  passwordInput: document.querySelector("#passwordInput"),
  loginError: document.querySelector("#loginError"),
  logoutBtn: document.querySelector("#logoutBtn"),
  connectPrinterBtn: document.querySelector("#connectPrinterBtn"),
  userBadge: document.querySelector("#userBadge"),
  printerBadge: document.querySelector("#printerBadge"),
  syncBadge: document.querySelector("#syncBadge"),
  waiterPanel: document.querySelector("#waiterPanel"),
  boardTitle: document.querySelector("#boardTitle"),
  tableGrid: document.querySelector("#tableGrid"),
  categoryTabs: document.querySelector("#categoryTabs"),
  menuSearch: document.querySelector("#menuSearch"),
  menuGrid: document.querySelector("#menuGrid"),
  cartTableLabel: document.querySelector("#cartTableLabel"),
  cartItems: document.querySelector("#cartItems"),
  cartTotal: document.querySelector("#cartTotal"),
  orderNotes: document.querySelector("#orderNotes"),
  clearCartBtn: document.querySelector("#clearCartBtn"),
  sendOrderBtn: document.querySelector("#sendOrderBtn"),
  statusTabs: document.querySelector("#statusTabs"),
  ordersList: document.querySelector("#ordersList"),
  printArea: document.querySelector("#printArea")
};

let app;
let auth;
let db;
let currentUser = null;
let profile = null;
let menuItems = [];
let orders = [];
let unsubscribeOrders = null;
let selectedTable = TABLES[0];
let selectedCategory = "Tutti";
let statusFilter = "all";
let cart = new Map();
let serialPort = null;

init();

async function init() {
  lucide.createIcons();
  renderTables();
  bindEvents();

  if (!isConfigured()) {
    els.loginError.textContent = "Configura firebaseConfig in app.js.";
    return;
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  await setPersistence(auth, browserLocalPersistence);

  onAuthStateChanged(auth, async (user) => {
    if (user) await enterApp(user);
    else showLogin();
  });
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutBtn.addEventListener("click", logout);
  els.connectPrinterBtn.addEventListener("click", connectPrinter);
  els.menuSearch.addEventListener("input", renderMenu);
  els.clearCartBtn.addEventListener("click", clearCart);
  els.sendOrderBtn.addEventListener("click", sendOrder);
  els.statusTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    statusFilter = button.dataset.status;
    els.statusTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    renderOrders();
  });
}

function isConfigured() {
  return firebaseConfig.apiKey.startsWith("AIza") && !firebaseConfig.projectId.startsWith("INSERISCI");
}

async function handleLogin(event) {
  event.preventDefault();
  els.loginError.textContent = "";
  const username = els.usernameInput.value.trim().toLowerCase();
  const password = els.passwordInput.value;
  const email = `${username}@${AUTH_EMAIL_DOMAIN}`;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    els.loginError.textContent = "Credenziali non valide.";
  }
}

async function enterApp(user) {
  currentUser = user;
  const profileSnap = await getDoc(doc(db, "profiles", user.uid));
  if (!profileSnap.exists()) {
    els.loginError.textContent = "Profilo staff non trovato. Controlla Firestore > profiles.";
    await signOut(auth);
    return;
  }

  profile = { id: profileSnap.id, ...profileSnap.data() };
  els.loginView.hidden = true;
  els.mainView.hidden = false;
  els.waiterPanel.hidden = profile.role !== "waiter";
  els.boardTitle.textContent = profile.role === "waiter" ? "Le mie comande" : "Tutte le comande";
  els.userBadge.textContent = `${profile.display_name || profile.username} - ${profile.role === "waiter" ? "Cameriere" : "Amministratore/Cucina"}`;

  await loadMenu();
  subscribeOrders();
  renderAll();
}

function showLogin() {
  if (unsubscribeOrders) unsubscribeOrders();
  currentUser = null;
  profile = null;
  orders = [];
  els.mainView.hidden = true;
  els.loginView.hidden = false;
}

async function loadMenu() {
  const menuSnap = await getDocs(query(collection(db, "menu_items"), where("active", "==", true)));
  menuItems = menuSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  if (!menuItems.length) menuItems = fallbackMenu;
  menuItems.sort((a, b) => `${a.category}${a.name}`.localeCompare(`${b.category}${b.name}`, "it"));
}

function subscribeOrders() {
  if (unsubscribeOrders) unsubscribeOrders();

  const ordersRef = collection(db, "orders");
  const ordersQuery = profile.role === "admin"
    ? query(ordersRef, orderBy("created_at", "desc"), limit(100))
    : query(ordersRef, where("waiter_id", "==", currentUser.uid), limit(100));

  unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
    orders = snapshot.docs.map((item) => normalizeOrder({ id: item.id, ...item.data() }));
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    els.syncBadge.textContent = "Realtime attivo";
    renderOrders();
  }, (error) => {
    els.syncBadge.textContent = "Realtime non disponibile";
    console.error(error);
  });
}

function normalizeOrder(order) {
  return {
    ...order,
    created_at: order.created_at?.toDate ? order.created_at.toDate().toISOString() : order.created_at || new Date().toISOString(),
    total: Number(order.total || 0)
  };
}

function renderAll() {
  renderCategories();
  renderMenu();
  renderCart();
  renderOrders();
  lucide.createIcons();
}

function renderTables() {
  els.tableGrid.innerHTML = TABLES.map((table) => (
    `<button class="table-btn ${table === selectedTable ? "active" : ""}" type="button" data-table="${table}">T${table}</button>`
  )).join("");

  els.tableGrid.onclick = (event) => {
    const button = event.target.closest("button[data-table]");
    if (!button) return;
    selectedTable = Number(button.dataset.table);
    renderTables();
    renderCart();
  };
}

function renderCategories() {
  const categories = ["Tutti", ...new Set(menuItems.map((item) => item.category))];
  els.categoryTabs.innerHTML = categories.map((category) => (
    `<button class="${category === selectedCategory ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  )).join("");

  els.categoryTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;
      renderCategories();
      renderMenu();
    });
  });
}

function renderMenu() {
  const queryText = els.menuSearch.value.trim().toLowerCase();
  const filtered = menuItems.filter((item) => {
    const categoryMatch = selectedCategory === "Tutti" || item.category === selectedCategory;
    const queryMatch = !queryText || item.name.toLowerCase().includes(queryText);
    return categoryMatch && queryMatch;
  });

  els.menuGrid.innerHTML = filtered.map((item) => (
    `<button class="menu-card" type="button" data-id="${escapeHtml(String(item.id))}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.category)}</span>
      <span class="price">${formatMoney(item.price)}</span>
    </button>`
  )).join("");

  els.menuGrid.querySelectorAll(".menu-card").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.id));
  });
}

function addToCart(id) {
  const item = menuItems.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const existing = cart.get(id);
  cart.set(id, { ...item, qty: existing ? existing.qty + 1 : 1 });
  renderCart();
}

function renderCart() {
  els.cartTableLabel.textContent = `Tavolo ${selectedTable}`;
  if (!cart.size) {
    els.cartItems.className = "cart-items empty";
    els.cartItems.textContent = "Nessun articolo selezionato.";
    els.cartTotal.textContent = formatMoney(0);
    els.sendOrderBtn.disabled = true;
    return;
  }

  els.cartItems.className = "cart-items";
  els.cartItems.innerHTML = [...cart.values()].map((item) => (
    `<div class="cart-line">
      <strong>${item.qty}x</strong>
      <span>${escapeHtml(item.name)}</span>
      <span class="qty-controls">
        <button type="button" data-action="minus" data-id="${escapeHtml(String(item.id))}">-</button>
        <button type="button" data-action="plus" data-id="${escapeHtml(String(item.id))}">+</button>
      </span>
    </div>`
  )).join("");

  els.cartItems.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => changeQty(button.dataset.id, button.dataset.action === "plus" ? 1 : -1));
  });

  els.cartTotal.textContent = formatMoney(getCartTotal());
  els.sendOrderBtn.disabled = false;
}

function changeQty(id, delta) {
  const item = cart.get(id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.delete(id);
  else cart.set(id, item);
  renderCart();
}

function clearCart() {
  cart.clear();
  els.orderNotes.value = "";
  renderCart();
}

async function sendOrder() {
  if (!cart.size) return;
  els.sendOrderBtn.disabled = true;
  const orderForPrint = {
    table_number: selectedTable,
    waiter_id: currentUser.uid,
    waiter_name: profile.display_name || profile.username,
    status: "new",
    notes: els.orderNotes.value.trim(),
    items: [...cart.values()].map(({ id, name, category, price, qty }) => ({ id, name, category, price: Number(price), qty })),
    total: getCartTotal(),
    created_at: new Date().toISOString()
  };

  try {
    const orderRef = await addDoc(collection(db, "orders"), {
      ...orderForPrint,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    await printOrder({ id: orderRef.id, ...orderForPrint });
    clearCart();
  } catch (error) {
    alert(`Comanda non salvata: ${error.message}`);
  } finally {
    els.sendOrderBtn.disabled = false;
  }
}

function getCartTotal() {
  return [...cart.values()].reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
}

function renderOrders() {
  const visible = orders.filter((order) => statusFilter === "all" || order.status === statusFilter);
  if (!visible.length) {
    els.ordersList.innerHTML = `<div class="empty-state">Nessuna comanda da mostrare.</div>`;
    return;
  }

  els.ordersList.innerHTML = visible.map((order) => {
    const canManage = profile?.role === "admin";
    const actions = canManage ? `
      <button class="ghost-action" type="button" data-next="preparing" data-id="${order.id}"><i data-lucide="flame"></i><span>In corso</span></button>
      <button class="ghost-action" type="button" data-next="ready" data-id="${order.id}"><i data-lucide="bell"></i><span>Pronta</span></button>
      <button class="ghost-action" type="button" data-next="served" data-id="${order.id}"><i data-lucide="check"></i><span>Servita</span></button>
    ` : "";

    return `<article class="order-card" data-status="${order.status}">
      <div class="order-head">
        <div>
          <strong>Tavolo ${order.table_number}</strong>
          <div class="order-meta">${formatTime(order.created_at)} - ${escapeHtml(order.waiter_name || "Staff")}</div>
        </div>
        <span class="status-pill">${STATUS_LABELS[order.status] || order.status}</span>
      </div>
      <ul class="order-items">
        ${(order.items || []).map((item) => `<li><strong>${item.qty}x</strong> ${escapeHtml(item.name)}</li>`).join("")}
      </ul>
      ${order.notes ? `<div class="order-note">${escapeHtml(order.notes)}</div>` : ""}
      <div class="order-actions">
        <strong>${formatMoney(order.total || 0)}</strong>
        <div class="topbar-actions">
          <button class="ghost-action" type="button" data-print="${order.id}"><i data-lucide="printer"></i><span>Stampa</span></button>
          ${actions}
        </div>
      </div>
    </article>`;
  }).join("");

  els.ordersList.querySelectorAll("button[data-next]").forEach((button) => {
    button.addEventListener("click", () => updateStatus(button.dataset.id, button.dataset.next));
  });
  els.ordersList.querySelectorAll("button[data-print]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = orders.find((item) => String(item.id) === String(button.dataset.print));
      if (order) printOrder(order);
    });
  });
  lucide.createIcons();
}

async function updateStatus(id, status) {
  try {
    await updateDoc(doc(db, "orders", id), { status, updated_at: serverTimestamp() });
  } catch (error) {
    alert(`Stato non aggiornato: ${error.message}`);
  }
}

async function connectPrinter() {
  if (!("serial" in navigator)) {
    els.printerBadge.textContent = "Web Serial non supportato: uso stampa browser";
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    els.printerBadge.textContent = "Stampante seriale collegata";
  } catch (error) {
    els.printerBadge.textContent = "Collegamento stampante annullato";
  }
}

async function printOrder(order) {
  if (serialPort?.writable) {
    try {
      await printEscPos(order);
      return;
    } catch (error) {
      els.printerBadge.textContent = "Errore seriale: uso stampa browser";
    }
  }

  renderReceipt(order);
  window.print();
}

async function printEscPos(order) {
  const writer = serialPort.writable.getWriter();
  const encoder = new TextEncoder();
  const lines = [
    "\x1B\x40",
    `\x1B\x61\x01${BRAND_NAME.toUpperCase()}\x1B\x61\x00`,
    `TAVOLO ${order.table_number}`,
    `${formatTime(order.created_at)} - ${order.waiter_name || "Staff"}`,
    "------------------------------",
    ...(order.items || []).map((item) => `${item.qty}x ${item.name}`),
    order.notes ? `NOTE: ${order.notes}` : "",
    "------------------------------",
    `Totale ${formatMoney(order.total || 0)}`,
    "\n\n\n\x1D\x56\x00"
  ].filter(Boolean).join("\n");

  await writer.write(encoder.encode(lines));
  writer.releaseLock();
}

function renderReceipt(order) {
  els.printArea.innerHTML = `
    <div class="receipt-title">${BRAND_NAME.toUpperCase()}</div>
    <div class="receipt-row"><strong>Tavolo</strong><span>${order.table_number}</span></div>
    <div class="receipt-row"><strong>Ora</strong><span>${formatTime(order.created_at)}</span></div>
    <div class="receipt-row"><strong>Staff</strong><span>${escapeHtml(order.waiter_name || "")}</span></div>
    <div class="receipt-items">
      ${(order.items || []).map((item) => `<div>${item.qty}x ${escapeHtml(item.name)}</div>`).join("")}
    </div>
    ${order.notes ? `<div><strong>Note:</strong> ${escapeHtml(order.notes)}</div>` : ""}
    <div class="receipt-row"><strong>Totale</strong><span>${formatMoney(order.total || 0)}</span></div>
  `;
}

async function logout() {
  if (unsubscribeOrders) unsubscribeOrders();
  await signOut(auth);
  clearCart();
}

function formatMoney(value) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
