// firebase-config.js

// هام: املأ هذه البيانات بمعلومات مشروع Firebase الخاص بك.
// 1. اذهب إلى لوحة تحكم Firebase لمشروعك.
// 2. في إعدادات المشروع (Project settings)، ابحث عن "Your apps".
// 3. ضمن "SDK setup and configuration"، اختر "Config".
// 4. انسخ كائن `firebaseConfig` والصقه هنا.

const firebaseConfig = {
  apiKey: "AIzaSyBmmzirF2SU8i2PalAP4I_6q5oRKETwIHc",
  authDomain: "home-calc-60da0.firebaseapp.com",
  projectId: "home-calc-60da0",
  storageBucket: "home-calc-60da0.appspot.com",
  messagingSenderId: "574499631039",
  appId: "1:574499631039:web:c8b5168e6957ffb4477b0a",
  measurementId: "G-9VB3N4K34N"
};

// هذا المعرف سيستخدم لإنشاء مسار فريد لبياناتك في Firestore.
// يمكنك استخدام أي سلسلة نصية فريدة. إذا كنت تريد مشاركة البيانات
// مع الأصدقاء، يجب أن تستخدموا جميعًا نفس `appId`.
const appId = "my-shared-expenses-app"; // يمكنك تغييره إلى أي شيء تريده

export { firebaseConfig, appId };
