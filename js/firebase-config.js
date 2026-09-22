// Firebase Console > Project settings > General > "Your apps" > Web app
// altında bulacağınız config nesnesini buraya yapıştırın.
// Bu değerler (apiKey dahil) gizli değildir, tarayıcıya gönderilmesi normaldir;
// gerçek güvenlik Firestore güvenlik kuralları (firestore.rules) ile sağlanır.
export const firebaseConfig = {
  apiKey: "TODO_API_KEY",
  authDomain: "TODO_PROJECT_ID.firebaseapp.com",
  projectId: "TODO_PROJECT_ID",
  storageBucket: "TODO_PROJECT_ID.appspot.com",
  messagingSenderId: "TODO_SENDER_ID",
  appId: "TODO_APP_ID"
};

// Eczane giriş ID'lerini Firebase Auth e-postasına çevirmek için kullanılan sabit alan adı.
// seed.js scripti de aynı değeri kullanır, değiştirirseniz ikisini birden güncelleyin.
export const LOGIN_EMAIL_DOMAIN = "manisaeczane45.local";
