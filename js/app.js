import { firebaseConfig, LOGIN_EMAIL_DOMAIN } from "./firebase-config.js?v=7";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, query, orderBy, limit,
  runTransaction, addDoc, serverTimestamp, getDocs, writeBatch, increment
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
const pharmacyCardsEl = document.getElementById("pharmacy-cards");
const adminCardsEl = document.getElementById("admin-cards");
const adminError = document.getElementById("admin-error");
const txLogEl = document.getElementById("transaction-log");
const clearLogBtn = document.getElementById("clear-log-btn");
const resetDataBtn = document.getElementById("reset-data-btn");
const pharmacyCardTemplate = document.getElementById("pharmacy-card-template");
const adminCardTemplate = document.getElementById("admin-card-template");

const distDrugNameInput = document.getElementById("dist-drug-name");
const distTotalUnitsInput = document.getElementById("dist-total-units");
const distTotalAmountInput = document.getElementById("dist-total-amount");
const distRowsEl = document.getElementById("dist-rows");
const distAddRowBtn = document.getElementById("dist-add-row-btn");
const distSubmitBtn = document.getElementById("dist-submit-btn");
const distError = document.getElementById("dist-error");
const distRowTemplate = document.getElementById("dist-row-template");

const tabButtons = document.querySelectorAll(".tab-btn");
const adminTabBtn = document.getElementById("admin-tab-btn");
const tabPanels = {
  pharmacies: document.getElementById("tab-panel-pharmacies"),
  admin: document.getElementById("tab-panel-admin"),
  log: document.getElementById("tab-panel-log"),
};

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("hidden")) return;
    activateTab(btn.dataset.tab);
  });
});

function activateTab(tabKey) {
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabKey));
  Object.entries(tabPanels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== tabKey);
  });
}

const pharmaciesCache = new Map();
let isAdmin = false;
let unsubPharmacies = null;
let unsubTransactions = null;

let distRows = [];
let distRowRefs = [];

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
  adminTabBtn.classList.toggle("hidden", !isAdmin);
  clearLogBtn.classList.toggle("hidden", !isAdmin);
  activateTab("pharmacies");

  subscribePharmacies();
  subscribeTransactions();
});

function subscribePharmacies() {
  const q = query(collection(db, "pharmacies"), orderBy("order"));
  unsubPharmacies = onSnapshot(q, (snapshot) => {
    pharmaciesCache.clear();
    snapshot.forEach((docSnap) => pharmaciesCache.set(docSnap.id, docSnap.data()));
    renderPharmacyList();
    if (isAdmin) {
      renderAdminList();
      renderDistRows();
    }
  }, (err) => {
    pharmacyCardsEl.innerHTML = `<p class="error-text">Veriler yüklenemedi.</p>`;
    if (isAdmin) {
      adminCardsEl.innerHTML = `<p class="error-text">Veriler yüklenemedi.</p>`;
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
    pharmacyCardsEl.innerHTML = `<p class="muted">Eczane bulunamadı.</p>`;
    return;
  }
  pharmacyCardsEl.innerHTML = "";
  for (const [, data] of pharmaciesCache) {
    const net = netCariOf(data);
    const card = pharmacyCardTemplate.content.cloneNode(true);
    card.querySelector(".ph-card-name").textContent = data.name;
    const balanceEl = card.querySelector(".ph-card-balance");
    balanceEl.textContent = currency(net);
    balanceEl.classList.add(net >= 0 ? "balance-positive" : "balance-negative");
    pharmacyCardsEl.appendChild(card);
  }
}

function renderAdminList() {
  if (pharmaciesCache.size === 0) {
    adminCardsEl.innerHTML = `<p class="muted">Eczane bulunamadı.</p>`;
    return;
  }
  adminCardsEl.innerHTML = "";
  for (const [id, data] of pharmaciesCache) {
    const net = netCariOf(data);
    const card = adminCardTemplate.content.cloneNode(true);
    card.querySelector(".admin-card-name").textContent = data.name;

    const netPill = card.querySelector(".ph-net");
    netPill.textContent = currency(net);
    netPill.classList.add(net >= 0 ? "balance-positive" : "balance-negative");

    card.querySelector(".ph-total").textContent = currency(data.totalCari || 0);
    card.querySelector(".ph-paid").textContent = currency(data.paidCari || 0);

    const totalInput = card.querySelector(".total-input");
    card.querySelector(".set-total-btn").addEventListener("click", async () => {
      const value = parseFloat(totalInput.value);
      if (Number.isNaN(value)) return;
      await updateTotalCari(id, data.name, value);
      totalInput.value = "";
    });

    const paymentInfoInput = card.querySelector(".payment-info-input");
    const paymentInput = card.querySelector(".payment-input");
    card.querySelector(".add-payment-btn").addEventListener("click", async () => {
      const amount = parseFloat(paymentInput.value);
      if (Number.isNaN(amount) || amount === 0) return;
      const info = paymentInfoInput.value.trim();
      await addPayment(id, data.name, amount, info);
      paymentInput.value = "";
      paymentInfoInput.value = "";
    });

    adminCardsEl.appendChild(card);
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

async function addPayment(pharmacyId, pharmacyName, amount, info) {
  adminError.textContent = "";
  try {
    const ref = doc(db, "pharmacies", pharmacyId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.data() || {};
      const newPaid = (current.paidCari || 0) + amount;
      tx.update(ref, { paidCari: newPaid });
    });
    const note = info
      ? (amount > 0
        ? `${pharmacyName} için ${info} ${currency(amount)} yemek kesildi`
        : `${pharmacyName} için ${info} ${currency(Math.abs(amount))} yemek eklendi (düzeltme)`)
      : (amount > 0
        ? `${pharmacyName}: ${currency(amount)} yemek kesildi`
        : `${pharmacyName}: ${currency(Math.abs(amount))} yemek eklendi (düzeltme)`);
    await addDoc(collection(db, "transactions"), {
      pharmacyId,
      pharmacyName,
      amount,
      info: info || null,
      note,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    adminError.textContent = "İşlem başarısız oldu.";
    console.error(err);
  }
}

clearLogBtn.addEventListener("click", async () => {
  if (!isAdmin) return;
  const confirmed = confirm("Tüm işlem geçmişi kalıcı olarak silinecek. Emin misiniz?");
  if (!confirmed) return;
  clearLogBtn.disabled = true;
  try {
    const snap = await getDocs(collection(db, "transactions"));
    const docs = snap.docs;
    const CHUNK_SIZE = 400;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      docs.slice(i, i + CHUNK_SIZE).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    alert("İşlem geçmişi silinemedi.");
    console.error(err);
  } finally {
    clearLogBtn.disabled = false;
  }
});

resetDataBtn.addEventListener("click", async () => {
  if (!isAdmin) return;
  const confirmed = confirm(
    "Tüm eczanelerin Toplam ve Ödenen cari bakiyeleri sıfırlanacak. Bu işlem geri alınamaz, emin misiniz?"
  );
  if (!confirmed) return;
  resetDataBtn.disabled = true;
  try {
    const snap = await getDocs(collection(db, "pharmacies"));
    const docs = snap.docs;
    const CHUNK_SIZE = 400;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      docs.slice(i, i + CHUNK_SIZE).forEach((d) => batch.update(d.ref, { totalCari: 0, paidCari: 0 }));
      await batch.commit();
    }
    await addDoc(collection(db, "transactions"), {
      pharmacyId: null,
      pharmacyName: null,
      amount: 0,
      note: "Tüm eczanelerin cari bakiyeleri sıfırlandı",
      createdAt: serverTimestamp()
    });
  } catch (err) {
    alert("Bakiyeler sıfırlanamadı.");
    console.error(err);
  } finally {
    resetDataBtn.disabled = false;
  }
});

function computeDistPreview(adet) {
  const totalUnits = parseFloat(distTotalUnitsInput.value);
  const totalAmount = parseFloat(distTotalAmountInput.value);
  if (!adet || !Number.isFinite(totalUnits) || totalUnits <= 0 || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return "";
  }
  return "≈ " + currency((adet / totalUnits) * totalAmount);
}

function updateAllDistPreviews() {
  distRowRefs.forEach((ref, idx) => {
    ref.previewSpan.textContent = computeDistPreview(distRows[idx].adet);
  });
}

distTotalUnitsInput.addEventListener("input", updateAllDistPreviews);
distTotalAmountInput.addEventListener("input", updateAllDistPreviews);

function renderDistRows() {
  distRowsEl.innerHTML = "";
  distRowRefs = [];

  distRows.forEach((row, idx) => {
    const frag = distRowTemplate.content.cloneNode(true);
    const select = frag.querySelector(".dist-pharmacy-select");
    const adetInput = frag.querySelector(".dist-adet-input");
    const previewSpan = frag.querySelector(".dist-preview");
    const removeBtn = frag.querySelector(".dist-remove-btn");

    for (const [id, data] of pharmaciesCache) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = data.name;
      select.appendChild(opt);
    }
    if (!row.pharmacyId && select.options.length > 0) {
      row.pharmacyId = select.options[0].value;
    }
    select.value = row.pharmacyId || "";
    select.addEventListener("change", () => {
      row.pharmacyId = select.value;
    });

    adetInput.value = row.adet || "";
    adetInput.addEventListener("input", () => {
      row.adet = parseFloat(adetInput.value) || 0;
      previewSpan.textContent = computeDistPreview(row.adet);
    });

    removeBtn.addEventListener("click", () => {
      distRows.splice(idx, 1);
      renderDistRows();
    });

    distRowsEl.appendChild(frag);
    distRowRefs.push({ adetInput, previewSpan, select });
  });

  updateAllDistPreviews();
}

distAddRowBtn.addEventListener("click", () => {
  distRows.push({ pharmacyId: null, adet: 0 });
  renderDistRows();
});

distSubmitBtn.addEventListener("click", async () => {
  distError.textContent = "";

  const drugName = distDrugNameInput.value.trim();
  const totalUnits = parseFloat(distTotalUnitsInput.value);
  const totalAmount = parseFloat(distTotalAmountInput.value);

  if (!drugName) { distError.textContent = "İlaç adı girin."; return; }
  if (!Number.isFinite(totalUnits) || totalUnits <= 0) { distError.textContent = "Toplam ilaç adedi geçerli olmalı."; return; }
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) { distError.textContent = "Toplam yemek tutarı geçerli olmalı."; return; }
  if (distRows.length === 0) { distError.textContent = "En az bir eczane ekleyin."; return; }

  const seen = new Set();
  let sumAdet = 0;
  for (const row of distRows) {
    if (!row.pharmacyId) { distError.textContent = "Her satırda bir eczane seçili olmalı."; return; }
    if (seen.has(row.pharmacyId)) { distError.textContent = "Aynı eczane birden fazla kez eklenemez."; return; }
    seen.add(row.pharmacyId);
    if (!row.adet || row.adet <= 0) { distError.textContent = "Her satırda geçerli bir adet girin."; return; }
    sumAdet += row.adet;
  }
  if (sumAdet > totalUnits + 0.0001) {
    distError.textContent = `Girilen adetler toplamı (${sumAdet}) toplam ilaç adedini (${totalUnits}) aşamaz.`;
    return;
  }

  distSubmitBtn.disabled = true;
  try {
    const batch = writeBatch(db);
    for (const row of distRows) {
      const amount = (row.adet / totalUnits) * totalAmount;
      const pharmacyName = pharmaciesCache.get(row.pharmacyId)?.name || row.pharmacyId;

      batch.update(doc(db, "pharmacies", row.pharmacyId), { totalCari: increment(amount) });
      batch.set(doc(collection(db, "transactions")), {
        pharmacyId: row.pharmacyId,
        pharmacyName,
        amount,
        note: `${pharmacyName}: ${drugName} (${row.adet}/${totalUnits} adet) karşılığı ${currency(amount)} yemek cari eklendi`,
        createdAt: serverTimestamp()
      });
    }
    await batch.commit();

    distDrugNameInput.value = "";
    distTotalUnitsInput.value = "";
    distTotalAmountInput.value = "";
    distRows = [];
    renderDistRows();
  } catch (err) {
    distError.textContent = "Dağıtım başarısız oldu.";
    console.error(err);
  } finally {
    distSubmitBtn.disabled = false;
  }
});
