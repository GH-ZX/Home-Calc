// firebase-config.js

// هام: املأ هذه البيانات بمعلومات مشروع Firebase الخاص بك.
// 1. اذهب إلى لوحة تحكم Firebase لمشروعك.
// 2. في إعدادات المشروع (Project settings)، ابحث عن "Your apps".
// 3. ضمن "SDK setup and configuration"، اختر "Config".
// 4. انسخ كائن `firebaseConfig` والصقه هنا.

const firebaseConfig = {
  apiKey: "AIzaSyCB3wk3MH7YcWxriGXYS6-OYboRy4UIwLo",
  authDomain: "home-calculator-97fdf.firebaseapp.com",
  projectId: "home-calculator-97fdf",
  storageBucket: "home-calculator-97fdf.firebasestorage.app",
  messagingSenderId: "438531796785",
  appId: "1:438531796785:web:605c3a433ebbdfd8e54a10",
  measurementId: "G-6DX0PQ78PS"
};

// هذا المعرف سيستخدم لإنشاء مسار فريد لبياناتك في Firestore.
// يمكنك استخدام أي سلسلة نصية فريدة. إذا كنت تريد مشاركة البيانات
// مع الأصدقاء، يجب أن تستخدموا جميعًا نفس `appId`.
const appId = "my-shared-expenses-app"; // يمكنك تغييره إلى أي شيء تريده

export { firebaseConfig, appId };
