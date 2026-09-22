/**
 * Tek seferlik kurulum scripti.
 *
 * Ne yapar:
 *  - 18 eczane icin Firebase Auth kullanicisi (ecz01..ecz18) ve Firestore
 *    dokumani (pharmacies/ecz01..ecz18) olusturur, rastgele sifre atar.
 *  - 1 admin kullanicisi (admin) olusturur ve ona { admin: true } custom
 *    claim'i atar (Firestore kurallari bu claim'i kontrol eder).
 *  - Uretilen ID/sifre listesini scripts/credentials.txt dosyasina yazar.
 *
 * Nasil calistirilir:
 *  1) Firebase Console > Project settings > Service accounts >
 *     "Generate new private key" ile bir JSON anahtari indirin.
 *  2) Indirilen dosyayi bu klasore serviceAccountKey.json adiyla koyun.
 *     (Bu dosya .gitignore'da olmali, ASLA repoya commitlemeyin.)
 *  3) Firebase Console > Authentication > Sign-in method'dan
 *     "E-posta/Şifre" saglayicisini etkinlestirin.
 *  4) Bu klasorde: npm install && npm run seed
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const admin = require("firebase-admin");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");
const LOGIN_EMAIL_DOMAIN = "manisaeczane45.local"; // js/firebase-config.js ile ayni olmali

const PHARMACY_NAMES = [
  "Nar Eczanesi",
  "Korkmaz Eczanesi",
  "Kalfaoğlu Eczanesi",
  "Sevim Eczanesi",
  "Gürer Eczanesi",
  "Akar Eczanesi",
  "Yeni Eczanesi",
  "Ayşenur Eczanesi",
  "Buğra Eczanesi",
  "Akdur Eczanesi",
  "Ufuk Eczanesi",
  "Ayşem Eczanesi",
  "Deniz Eczanesi",
  "Emine Betül Eczanesi",
  "Buse Eczanesi",
  "Çalışkan Eczanesi",
  "Aksoy Eczanesi",
  "Uncubozköy Eczanesi",
  "Manisa Sağlık Eczanesi",
];

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "HATA: scripts/serviceAccountKey.json bulunamadi.\n" +
    "Firebase Console > Project settings > Service accounts > Generate new private key\n" +
    "ile indirip bu klasore koyun."
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

const auth = admin.auth();
const db = admin.firestore();

function generatePassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 10);
}

async function upsertUser(email, password, extraClaims) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password });
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      userRecord = await auth.createUser({ email, password, emailVerified: true });
    } else {
      throw err;
    }
  }
  if (extraClaims) {
    await auth.setCustomUserClaims(userRecord.uid, extraClaims);
  }
  return userRecord;
}

async function main() {
  const lines = [];
  lines.push("Manisa Eczaneleri 45 - Giris Bilgileri");
  lines.push("Bu dosyayi GUVENLI bir yerde saklayin, repoya COMMITLEMEYIN.");
  lines.push("");

  // Admin kullanicisi
  const adminId = "admin";
  const adminPassword = generatePassword();
  await upsertUser(`${adminId}@${LOGIN_EMAIL_DOMAIN}`, adminPassword, { admin: true });
  lines.push(`ADMIN  | ID: ${adminId}  | Sifre: ${adminPassword}`);
  lines.push("");

  // Eczaneler
  for (let i = 1; i <= PHARMACY_NAMES.length; i++) {
    const id = `ecz${String(i).padStart(2, "0")}`;
    const password = generatePassword();
    const name = PHARMACY_NAMES[i - 1];

    await upsertUser(`${id}@${LOGIN_EMAIL_DOMAIN}`, password, { admin: false });

    await db.collection("pharmacies").doc(id).set({
      name,
      order: i,
      totalCari: 0,
      paidCari: 0,
    }, { merge: true });

    lines.push(`${name.padEnd(10)} | ID: ${id}  | Sifre: ${password}`);
  }

  const outPath = path.join(__dirname, "credentials.txt");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log(lines.join("\n"));
  console.log(`\nTamamlandi. Bilgiler ayrica ${outPath} dosyasina yazildi.`);
  console.log("Eczane isimlerini gercek isimlerle degistirmek icin Firestore'daki");
  console.log("pharmacies koleksiyonundan 'name' alanini elle guncelleyebilirsiniz.");
}

main().catch((err) => {
  console.error("Seed islemi basarisiz:", err);
  process.exit(1);
});
