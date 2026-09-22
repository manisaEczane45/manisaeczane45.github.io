import { firebaseConfig, LOGIN_EMAIL_DOMAIN } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, query, orderBy, limit,
  runTransaction, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const currentUserLabel = document.getElementById("current-user-label");
const logoutBtn = document.getElementById("logout-btn");
const pharmacyListEl = document.getElementById("pharmacy-list");
const adminSection = document.getElementById("admin-section");
const adminPharmacyListEl = document.getElementById("admin-pharmacy-list");
const adminError = document.getElementById("admin-error");
const txLogEl = document.getElementById("transaction-log");
const adminRowTemplate = document.getElementById("admin-row-template");

const pharmaciesCache = new Map();
let isAdmin = false;
let unsubPharmacies = null;
let unsubTransactions = null;

const currency = (n) =>
  (n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";

const dateFmt = (ts) => {
  if (!ts || !ts.toDate) return "";
  return ts.toDate().toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
};

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const id = document.getElementById("login-id").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  if (!id || !password) return;
  const email = `${id}@${LOGIN_EMAIL_DOMAIN}`;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "Giriş başarısız. ID veya şifre hatalı.";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (unsubPharmacies) { unsubPharmacies(); unsubPharmacies = null; }
  if (unsubTransactions) { unsubTransactions(); unsubTransactions = null; }
  pharmaciesCache.clear();

  if (!user) {
    isAdmin = false;
    loginScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    loginForm.reset();
    return;
  }

  const tokenResult = await user.getIdTokenResult();
  isAdmin = tokenResult.claims.admin === true;

  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  currentUserLabel.textContent = user.email.split("@")[0];
  adminSection.classList.toggle("hidden", !isAdmin);

  subscribePharmacies();
  subscribeTransactions();
});

function subscribePharmacies() {
  const q = query(collection(db, "pharmacies"), orderBy("order"));
  unsubPharmacies = onSnapshot(q, (snapshot) => {
    pharmaciesCache.clear();
    snapshot.forEach((docSnap) => pharmaciesCache.set(docSnap.id, docSnap.data()));
    renderPharmacyList();
    if (isAdmin) renderAdminList();
  }, (err) => {
    pharmacyListEl.innerHTML = `<tr><td colspan="2" class="error-text">Veriler yüklenemedi.</td></tr>`;
    if (isAdmin) {
      adminPharmacyListEl.innerHTML = `<tr><td colspan="5" class="error-text">Veriler yüklenemedi.</td></tr>`;
    }
    console.error(err);
  });
}

function subscribeTransactions() {
  const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(100));
  unsubTransactions = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      txLogEl.innerHTML = `<li class="muted">Henüz işlem yok.</li>`;
      return;
    }
    txLogEl.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const tx = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `<span>${tx.note || ""}</span><span class="tx-date">${dateFmt(tx.createdAt)}</span>`;
      txLogEl.appendChild(li);
    });
  }, (err) => {
    txLogEl.innerHTML = `<li class="error-text">İşlem geçmişi yüklenemedi.</li>`;
    console.error(err);
  });
}

function netCariOf(data) {
  return (data.totalCari || 0) - (data.paidCari || 0);
}

function renderPharmacyList() {
  if (pharmaciesCache.size === 0) {
    pharmacyListEl.innerHTML = `<tr><td colspan="2" class="muted">Eczane bulunamadı.</td></tr>`;
    return;
  }
  pharmacyListEl.innerHTML = "";
  for (const [, data] of pharmaciesCache) {
    const net = netCariOf(data);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.name}</td>
      <td class="${net >= 0 ? "balance-positive" : "balance-negative"}">${currency(net)}</td>
    `;
    pharmacyListEl.appendChild(tr);
  }
}

function renderAdminList() {
  if (pharmaciesCache.size === 0) {
    adminPharmacyListEl.innerHTML = `<tr><td colspan="5" class="muted">Eczane bulunamadı.</td></tr>`;
    return;
  }
  adminPharmacyListEl.innerHTML = "";
  for (const [id, data] of pharmaciesCache) {
    const net = netCariOf(data);
    const row = adminRowTemplate.content.cloneNode(true);
    row.querySelector(".ph-name").textContent = data.name;
    row.querySelector(".ph-total").textContent = currency(data.totalCari || 0);
    row.querySelector(".ph-paid").textContent = currency(data.paidCari || 0);
    const netCell = row.querySelector(".ph-net");
    netCell.textContent = currency(net);
    netCell.className = "ph-net " + (net >= 0 ? "balance-positive" : "balance-negative");

    const totalInput = row.querySelector(".total-input");
    row.querySelector(".set-total-btn").addEventListener("click", async () => {
      const value = parseFloat(totalInput.value);
      if (Number.isNaN(value)) return;
      await updateTotalCari(id, data.name, value);
      totalInput.value = "";
    });

    const paymentInput = row.querySelector(".payment-input");
    row.querySelector(".add-payment-btn").addEventListener("click", async () => {
      const amount = parseFloat(paymentInput.value);
      if (Number.isNaN(amount) || amount === 0) return;
      await addPayment(id, data.name, amount);
      paymentInput.value = "";
    });

    adminPharmacyListEl.appendChild(row);
  }
}

async function updateTotalCari(pharmacyId, pharmacyName, newTotal) {
  adminError.textContent = "";
  try {
    const ref = doc(db, "pharmacies", pharmacyId);
    await runTransaction(db, async (tx) => {
      tx.update(ref, { totalCari: newTotal });
    });
    await addDoc(collection(db, "transactions"), {
      pharmacyId,
      pharmacyName,
      amount: newTotal,
      note: `${pharmacyName}: Toplam cari ${currency(newTotal)} olarak güncellendi`,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    adminError.textContent = "Güncelleme başarısız oldu.";
    console.error(err);
  }
}

async function addPayment(pharmacyId, pharmacyName, amount) {
  adminError.textContent = "";
  try {
    const ref = doc(db, "pharmacies", pharmacyId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.data() || {};
      const newPaid = (current.paidCari || 0) + amount;
      tx.update(ref, { paidCari: newPaid });
    });
    const note = amount > 0
      ? `${pharmacyName}: ${currency(amount)} yemek kesildi`
      : `${pharmacyName}: ${currency(Math.abs(amount))} yemek eklendi (düzeltme)`;
    await addDoc(collection(db, "transactions"), {
      pharmacyId,
      pharmacyName,
      amount,
      note,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    adminError.textContent = "İşlem başarısız oldu.";
    console.error(err);
  }
}
