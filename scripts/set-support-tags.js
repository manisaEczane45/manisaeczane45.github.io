/**
 * Tek seferlik kurulum scripti: Destek Ekibi Ortak Bütçesi özelliği için
 * pharmacies/{id} dokümanlarına supportContributor / supportRecipient alanlarını yazar.
 *
 * - supportContributor: false  -> bu eczaneden aylık 1000 TL destek payı TOPLANMAZ.
 *   (Alan hiç yoksa varsayılan true kabul edilir, yani diğer tüm eczaneler katkı sağlar.)
 * - supportRecipient: true     -> bu eczane ortak bütçeden pay ALABİLİR
 *   (Admin Paneli > Destek Ekibi > "Ortak Bütçeden Eczaneye Aktarım" seçiminde görünür.)
 *
 * Nasıl çalıştırılır:
 *   scripts/serviceAccountKey.json hazır olduğunda:
 *   cd scripts && node set-support-tags.js
 */

const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");

// Katkıdan muaf + ortak bütçeden pay alabilecek eczaneler (pharmacies/{id} doküman ID'leri).
const EXCLUDED_FROM_CONTRIBUTION_AND_RECIPIENT = ["gurer", "kalfaoglu", "nar", "uncubozkoy"];

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

const db = admin.firestore();

async function main() {
  const batch = db.batch();
  for (const id of EXCLUDED_FROM_CONTRIBUTION_AND_RECIPIENT) {
    const ref = db.collection("pharmacies").doc(id);
    batch.update(ref, { supportContributor: false, supportRecipient: true });
  }
  await batch.commit();
  console.log(
    "Güncellendi:",
    EXCLUDED_FROM_CONTRIBUTION_AND_RECIPIENT.join(", "),
    "-> supportContributor: false, supportRecipient: true"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
