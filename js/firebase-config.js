// Firebase Console > Project settings > General > "Your apps" > Web app
// altında bulacağınız config nesnesini buraya yapıştırın.
// Bu değerler (apiKey dahil) gizli değildir, tarayıcıya gönderilmesi normaldir;
// gerçek güvenlik Firestore güvenlik kuralları (firestore.rules) ile sağlanır.
export const firebaseConfig = {
  apiKey: "AIzaSyDE8Re1Xn31eYNg1DAivvizefOoN3gSacM",
  authDomain: "manisaeczane45-1bbfe.firebaseapp.com",
  projectId: "manisaeczane45-1bbfe",
  storageBucket: "manisaeczane45-1bbfe.firebasestorage.app",
  messagingSenderId: "105209289617",
  appId: "1:105209289617:web:c6a5e1bc16802544f69830"
};

// Eczane giriş ID'lerini Firebase Auth e-postasına çevirmek için kullanılan sabit alan adı.
// seed.js scripti de aynı değeri kullanır, değiştirirseniz ikisini birden güncelleyin.
export const LOGIN_EMAIL_DOMAIN = "manisaeczane45.local";
