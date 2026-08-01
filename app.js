import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
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
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAR5cixKQ9FutdOAWOI3xjeceeZ305TBds",
  authDomain: "brik-comande.firebaseapp.com",
  projectId: "brik-comande",
  storageBucket: "brik-comande.firebasestorage.app",
  messagingSenderId: "809712610365",
  appId: "1:809712610365:web:b0ffe512190e4bed3f0e54"
};

const BRAND_NAME = "Brik";
const AUTH_EMAIL_DOMAIN = "brik.local";
const ADMIN_BOOTSTRAP_EMAIL = "leoriellooo@gmail.com";
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
  { id: "cola", name: "Cola", category: "Bevande", price: 3.0, active: true },
  { id: "margherita", name: "Pizza Margherita", category: "Cucina", price: 7.5, active: true },
  { id: "diavola", name: "Pizza Diavola", category: "Cucina", price: 9.0, active: true },
  { id: "tagliere", name: "Tagliere misto", category: "Cucina", price: 12.0, active: true },
  { id: "tiramisu", name: "Tiramisu", category: "Dolci", price: 5.0, active: true }
];

const els = {
  loginView: document.querySelector("#loginView"),
  mainView: document.querySelector("#mainView"),
  profilePicker: document.querySelector("#profilePicker"),
  loginForm: document.querySelector("#loginForm"),
  profileCards: document.querySelectorAll(".profile-card"),
  showManualLoginBtn: document.querySelector("#showManualLoginBtn"),
  backToProfilesBtn: document.querySelector("#backToProfilesBtn"),
  selectedUserAvatar: document.querySelector("#selectedUserAvatar"),
  selectedUserName: document.querySelector("#selectedUserName"),
  selectedUserRole: document.querySelector("#selectedUserRole"),
  usernameInput: document.querySelector("#usernameInput"),
  usernameLabel: document.querySelector("#usernameLabel"),
  manualUsernameInput: document.querySelector("#manualUsernameInput"),
  passwordInput: document.querySelector("#passwordInput"),
  loginError: document.querySelector("#loginError"),
  logoutBtn: document.querySelector("#logoutBtn"),
  connectPrinterBtn: document.querySelector("#connectPrinterBtn"),
  userBadge: document.querySelector("#userBadge"),
  printerBadge: document.querySelector("#printerBadge"),
  syncBadge: document.querySelector("#syncBadge"),
  waiterPanel: document.querySelector("#waiterPanel"),
  ordersBoard: document.querySelector("#ordersBoard"),
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
  printArea: document.querySelector("#printArea"),
  
  // Mobile specific elements
  tabNewOrder: document.querySelector("#tabNewOrder"),
  tabOrdersBoard: document.querySelector("#tabOrdersBoard"),
  activeOrdersBadge: document.querySelector("#activeOrdersBadge"),
  mobileCartBar: document.querySelector("#mobileCartBar"),
  openMobileCartBtn: document.querySelector("#openMobileCartBtn"),
  mobileCartCount: document.querySelector("#mobileCartCount"),
  mobileCartTable: document.querySelector("#mobileCartTable"),
  mobileCartTotal: document.querySelector("#mobileCartTotal"),
  mobileQuickSendBtn: document.querySelector("#mobileQuickSendBtn"),
  mobileCartModal: document.querySelector("#mobileCartModal"),
  closeMobileCartBackdrop: document.querySelector("#closeMobileCartBackdrop"),
  closeMobileCartBtn: document.querySelector("#closeMobileCartBtn"),
  drawerCartTable: document.querySelector("#drawerCartTable"),
  drawerCartItems: document.querySelector("#drawerCartItems"),
  drawerOrderNotes: document.querySelector("#drawerOrderNotes"),
  drawerCartTotal: document.querySelector("#drawerCartTotal"),
  drawerSendOrderBtn: document.querySelector("#drawerSendOrderBtn")
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
let isManualMode = false;

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
  // Staff Profile Selector Events
  els.profileCards.forEach((card) => {
    card.addEventListener("click", () => selectProfile(card));
  });

  if (els.backToProfilesBtn) {
    els.backToProfilesBtn.addEventListener("click", resetProfileSelection);
  }

  if (els.showManualLoginBtn) {
    els.showManualLoginBtn.addEventListener("click", enableManualLogin);
  }

  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutBtn.addEventListener("click", logout);
  els.connectPrinterBtn.addEventListener("click", connectPrinter);
  els.menuSearch.addEventListener("input", renderMenu);
  els.clearCartBtn.addEventListener("click", clearCart);
  els.sendOrderBtn.addEventListener("click", sendOrder);

  // Status Filter Tabs
  els.statusTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    statusFilter = button.dataset.status;
    els.statusTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    renderOrders();
  });

  // Mobile Navigation Tabs
  if (els.tabNewOrder && els.tabOrdersBoard) {
    els.tabNewOrder.addEventListener("click", () => switchMobileTab("waiterPanel"));
    els.tabOrdersBoard.addEventListener("click", () => switchMobileTab("ordersBoard"));
  }

  // Mobile Cart Drawer Events
  if (els.openMobileCartBtn) {
    els.openMobileCartBtn.addEventListener("click", openMobileCartDrawer);
  }
  if (els.closeMobileCartBtn) {
    els.closeMobileCartBtn.addEventListener("click", closeMobileCartDrawer);
  }
  if (els.closeMobileCartBackdrop) {
    els.closeMobileCartBackdrop.addEventListener("click", closeMobileCartDrawer);
  }
  if (els.mobileQuickSendBtn) {
    els.mobileQuickSendBtn.addEventListener("click", sendOrder);
  }
  if (els.drawerSendOrderBtn) {
    els.drawerSendOrderBtn.addEventListener("click", sendOrderFromDrawer);
  }

  // Sync Notes Textareas
  if (els.orderNotes && els.drawerOrderNotes) {
    els.orderNotes.addEventListener("input", () => {
      els.drawerOrderNotes.value = els.orderNotes.value;
    });
    els.drawerOrderNotes.addEventListener("input", () => {
      els.orderNotes.value = els.drawerOrderNotes.value;
    });
  }
}

function selectProfile(card) {
  const username = card.dataset.user;
  const email = card.dataset.email;
  const name = card.dataset.name;
  const role = card.dataset.role;

  isManualMode = false;
  els.usernameInput.value = email || `${username}@${AUTH_EMAIL_DOMAIN}`;
  if (els.manualUsernameInput) els.manualUsernameInput.value = "";
  if (els.usernameLabel) els.usernameLabel.hidden = true;

  if (els.selectedUserName) els.selectedUserName.textContent = name;
  if (els.selectedUserRole) els.selectedUserRole.textContent = role;

  if (els.selectedUserAvatar) {
    els.selectedUserAvatar.className = `avatar-badge avatar-${username}`;
    els.selectedUserAvatar.innerHTML = `<i data-lucide="${username === 'cucina' ? 'utensils' : username === 'leo' ? 'user-check' : 'user'}"></i>`;
    lucide.createIcons();
  }

  els.profilePicker.hidden = true;
  els.loginForm.hidden = false;
  els.loginError.textContent = "";
  els.passwordInput.value = "";
  els.passwordInput.focus();
}

function resetProfileSelection() {
  isManualMode = false;
  els.profilePicker.hidden = false;
  els.loginForm.hidden = true;
  els.loginError.textContent = "";
  els.passwordInput.value = "";
}

function enableManualLogin() {
  isManualMode = true;
  if (els.usernameLabel) els.usernameLabel.hidden = false;
  if (els.selectedUserName) els.selectedUserName.textContent = "Altro Account";
  if (els.selectedUserRole) els.selectedUserRole.textContent = "Inserimento manuale";
  if (els.selectedUserAvatar) {
    els.selectedUserAvatar.className = "avatar-badge avatar-mario";
    els.selectedUserAvatar.innerHTML = `<i data-lucide="key-round"></i>`;
    lucide.createIcons();
  }

  els.profilePicker.hidden = true;
  els.loginForm.hidden = false;
  els.loginError.textContent = "";
  if (els.manualUsernameInput) els.manualUsernameInput.focus();
}

function switchMobileTab(targetView) {
  if (targetView === "waiterPanel") {
    els.waiterPanel.hidden = false;
    els.ordersBoard.hidden = true;
    els.tabNewOrder.classList.add("active");
    els.tabOrdersBoard.classList.remove("active");
    if (cart.size > 0 && els.mobileCartBar) els.mobileCartBar.hidden = false;
  } else {
    els.waiterPanel.hidden = true;
    els.ordersBoard.hidden = false;
    els.tabOrdersBoard.classList.add("active");
    els.tabNewOrder.classList.remove("active");
    if (els.mobileCartBar) els.mobileCartBar.hidden = true;
  }
}

function openMobileCartDrawer() {
  if (els.mobileCartModal) els.mobileCartModal.hidden = false;
}

function closeMobileCartDrawer() {
  if (els.mobileCartModal) els.mobileCartModal.hidden = true;
}

function isConfigured() {
  return firebaseConfig.apiKey.startsWith("AIza") && !firebaseConfig.projectId.startsWith("INSERISCI");
}

async function handleLogin(event) {
  event.preventDefault();
  els.loginError.textContent = "";
  let login = isManualMode
    ? (els.manualUsernameInput?.value.trim().toLowerCase() || "")
    : els.usernameInput.value.trim().toLowerCase();
  
  const password = els.passwordInput.value;

  if (!login) {
    els.loginError.textContent = "Inserisci un nome utente valido.";
    return;
  }

  let emailsToTry = [];
  if (login.includes("@")) {
    emailsToTry.push(login);
  } else {
    emailsToTry.push(`${login}@${AUTH_EMAIL_DOMAIN}`);
    if (login === "leo" || login === "leoriellooo") {
      emailsToTry.push(ADMIN_BOOTSTRAP_EMAIL);
    }
  }

  let loggedIn = false;
  for (const email of emailsToTry) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      loggedIn = true;
      break;
    } catch (error) {
      // Continue to next email option if any
    }
  }

  if (!loggedIn) {
    els.loginError.textContent = "Credenziali non valide.";
  }
}

async function enterApp(user) {
  currentUser = user;
  const profileSnap = await getDoc(doc(db, "profiles", user.uid));
  if (!profileSnap.exists()) {
    if (user.email?.toLowerCase() !== ADMIN_BOOTSTRAP_EMAIL) {
      els.loginError.textContent = "Profilo staff non trovato. Controlla Firestore > profiles.";
      await signOut(auth);
      return;
    }

    await setDoc(doc(db, "profiles", user.uid), {
      username: "leoriellooo",
      display_name: "Leo",
      role: "admin"
    });
  }

  const nextProfileSnap = profileSnap.exists() ? profileSnap : await getDoc(doc(db, "profiles", user.uid));
  profile = { id: nextProfileSnap.id, ...nextProfileSnap.data() };
  els.loginView.hidden = true;
  els.mainView.hidden = false;

  const isWaiter = profile.role === "waiter";
  els.waiterPanel.hidden = !isWaiter && profile.role !== "admin";
  els.boardTitle.textContent = isWaiter ? "Le mie comande" : "Tutte le comande";
  els.userBadge.innerHTML = `<i data-lucide="user"></i> ${profile.display_name || profile.username} (${isWaiter ? "Cameriere" : profile.role === "admin" ? "Admin" : "Cucina"})`;

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
  resetProfileSelection();
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
  const ordersQuery = profile.role === "admin" || profile.role === "kitchen"
    ? query(ordersRef, orderBy("created_at", "desc"), limit(100))
    : query(ordersRef, where("waiter_id", "==", currentUser.uid), limit(100));

  unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
    orders = snapshot.docs.map((item) => normalizeOrder({ id: item.id, ...item.data() }));
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    els.syncBadge.innerHTML = `<i data-lucide="wifi"></i> Realtime attivo`;
    
    // Update active orders badge for waiter
    const activeCount = orders.filter(o => o.status !== "served").length;
    if (els.activeOrdersBadge) {
      els.activeOrdersBadge.textContent = activeCount;
      els.activeOrdersBadge.hidden = activeCount === 0;
    }

    renderOrders();
  }, (error) => {
    els.syncBadge.innerHTML = `<i data-lucide="wifi-off"></i> Realtime offline`;
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

  els.menuGrid.innerHTML = filtered.map((item) => {
    const cartEntry = cart.get(String(item.id));
    const qtyBadge = cartEntry ? `<span class="item-qty-badge">${cartEntry.qty}x</span>` : "";
    const cardClass = cartEntry ? "menu-card has-cart" : "menu-card";

    return `<button class="${cardClass}" type="button" data-id="${escapeHtml(String(item.id))}">
      ${qtyBadge}
      <strong>${escapeHtml(item.name)}</strong>
      <span class="category-name">${escapeHtml(item.category)}</span>
      <span class="price">${formatMoney(item.price)}</span>
    </button>`;
  }).join("");

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
  renderMenu();
}

function renderCart() {
  const total = getCartTotal();
  const totalFormatted = formatMoney(total);
  const totalItemsCount = [...cart.values()].reduce((sum, i) => sum + i.qty, 0);

  // Update Labels
  els.cartTableLabel.textContent = `Tavolo ${selectedTable}`;
  if (els.mobileCartTable) els.mobileCartTable.textContent = `Tavolo ${selectedTable}`;
  if (els.drawerCartTable) els.drawerCartTable.textContent = `Tavolo ${selectedTable}`;

  if (!cart.size) {
    const emptyMarkup = `<div class="cart-items empty">Nessun articolo selezionato.</div>`;
    els.cartItems.innerHTML = emptyMarkup;
    if (els.drawerCartItems) els.drawerCartItems.innerHTML = emptyMarkup;

    els.cartTotal.textContent = formatMoney(0);
    if (els.mobileCartTotal) els.mobileCartTotal.textContent = formatMoney(0);
    if (els.drawerCartTotal) els.drawerCartTotal.textContent = formatMoney(0);

    els.sendOrderBtn.disabled = true;
    if (els.mobileQuickSendBtn) els.mobileQuickSendBtn.disabled = true;
    if (els.drawerSendOrderBtn) els.drawerSendOrderBtn.disabled = true;

    if (els.mobileCartBar) els.mobileCartBar.hidden = true;
    closeMobileCartDrawer();
    return;
  }

  // Show mobile cart bar when items are added
  if (els.mobileCartBar && !els.waiterPanel.hidden) {
    els.mobileCartBar.hidden = false;
  }

  if (els.mobileCartCount) els.mobileCartCount.textContent = totalItemsCount;

  const itemsMarkup = [...cart.values()].map((item) => (
    `<div class="cart-line">
      <strong>${item.qty}x</strong>
      <span>${escapeHtml(item.name)}</span>
      <span class="qty-controls">
        <button type="button" data-action="minus" data-id="${escapeHtml(String(item.id))}">-</button>
        <button type="button" data-action="plus" data-id="${escapeHtml(String(item.id))}">+</button>
      </span>
    </div>`
  )).join("");

  els.cartItems.className = "cart-items";
  els.cartItems.innerHTML = itemsMarkup;
  if (els.drawerCartItems) {
    els.drawerCartItems.className = "cart-items";
    els.drawerCartItems.innerHTML = itemsMarkup;
  }

  // Bind Qty Buttons
  document.querySelectorAll(".cart-items button[data-action]").forEach((button) => {
    button.addEventListener("click", () => changeQty(button.dataset.id, button.dataset.action === "plus" ? 1 : -1));
  });

  els.cartTotal.textContent = totalFormatted;
  if (els.mobileCartTotal) els.mobileCartTotal.textContent = totalFormatted;
  if (els.drawerCartTotal) els.drawerCartTotal.textContent = totalFormatted;

  els.sendOrderBtn.disabled = false;
  if (els.mobileQuickSendBtn) els.mobileQuickSendBtn.disabled = false;
  if (els.drawerSendOrderBtn) els.drawerSendOrderBtn.disabled = false;
}

function changeQty(id, delta) {
  const item = cart.get(id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.delete(id);
  else cart.set(id, item);
  renderCart();
  renderMenu();
}

function clearCart() {
  cart.clear();
  if (els.orderNotes) els.orderNotes.value = "";
  if (els.drawerOrderNotes) els.drawerOrderNotes.value = "";
  renderCart();
  renderMenu();
}

async function sendOrderFromDrawer() {
  closeMobileCartDrawer();
  await sendOrder();
}

async function sendOrder() {
  if (!cart.size) return;
  els.sendOrderBtn.disabled = true;
  if (els.mobileQuickSendBtn) els.mobileQuickSendBtn.disabled = true;
  if (els.drawerSendOrderBtn) els.drawerSendOrderBtn.disabled = true;

  const notesText = (els.orderNotes?.value || els.drawerOrderNotes?.value || "").trim();

  const orderForPrint = {
    table_number: selectedTable,
    waiter_id: currentUser.uid,
    waiter_name: profile.display_name || profile.username,
    status: "new",
    notes: notesText,
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

    // On mobile, switch to orders board to see sent order
    if (window.innerWidth <= 900) {
      switchMobileTab("ordersBoard");
    }
  } catch (error) {
    alert(`Comanda non salvata: ${error.message}`);
  } finally {
    els.sendOrderBtn.disabled = false;
    if (els.mobileQuickSendBtn) els.mobileQuickSendBtn.disabled = false;
    if (els.drawerSendOrderBtn) els.drawerSendOrderBtn.disabled = false;
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
    const canManage = profile?.role === "admin" || profile?.role === "kitchen";
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
      ${order.notes ? `<div class="order-note"><strong>Note:</strong> ${escapeHtml(order.notes)}</div>` : ""}
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
    els.printerBadge.innerHTML = `<i data-lucide="printer"></i> Stampa browser pronta`;
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    els.printerBadge.innerHTML = `<i data-lucide="printer"></i> Stampante seriale ok`;
  } catch (error) {
    els.printerBadge.innerHTML = `<i data-lucide="printer"></i> Stampa browser pronta`;
  }
}

async function printOrder(order) {
  if (serialPort?.writable) {
    try {
      await printEscPos(order);
      return;
    } catch (error) {
      els.printerBadge.innerHTML = `<i data-lucide="printer"></i> Stampa browser pronta`;
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
