// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, orderBy, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCB3wk3MH7YcWxriGXYS6-OYboRy4UIwLo",
  authDomain: "home-calculator-97fdf.firebaseapp.com",
  projectId: "home-calculator-97fdf",
  storageBucket: "home-calculator-97fdf.appspot.com",
  messagingSenderId: "438531796785",
  appId: "1:438531796785:web:605c3a433ebbdfd8e54a10",
  measurementId: "G-6DX0PQ78PS"
};


// --- GLOBAL VARIABLES ---
let db, auth;
let logUnsubscribe;

// --- DOM ELEMENTS ---
const logTableBody = document.getElementById('logTableBody');
const authContainer = document.getElementById('auth-container');
const appContent = document.getElementById('app-content');
const authMessage = document.getElementById('auth-message');
const clearLogBtn = document.getElementById('clearLogBtn');

// --- FIREBASE INITIALIZATION & AUTH ---
async function initializeFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, user => {
            if (logUnsubscribe) logUnsubscribe();

            if (user) {
                renderLoggedInUI(user);
                appContent.classList.remove('hidden');
                authMessage.classList.add('hidden');
                setupLogListener(user.uid);
            } else {
                renderLoggedOutUI();
                appContent.classList.add('hidden');
                authMessage.classList.remove('hidden');
                logTableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">الرجاء تسجيل الدخول.</td></tr>';
            }
        });
    } catch (error) {
        console.error("Firebase initialization failed:", error);
    }
}

// --- DATA HANDLING ---
function setupLogListener(userId) {
    const logCollectionPath = `users/${userId}/payment_log`;
    const logQuery = query(collection(db, logCollectionPath), orderBy("timestamp", "desc"));

    logUnsubscribe = onSnapshot(logQuery, snapshot => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderLogTable(logs);
    }, error => {
        console.error("Error fetching payment log:", error);
        logTableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">فشل في تحميل السجل.</td></tr>';
    });

    clearLogBtn.onclick = () => clearLog(userId);
}


async function clearLog(userId) {
    if (!confirm("هل أنت متأكد أنك تريد مسح سجل الدفعات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.")) {
        return;
    }
    const logCollectionPath = `users/${userId}/payment_log`;
    const logCollectionRef = collection(db, logCollectionPath);
    
    try {
        const snapshot = await getDocs(logCollectionRef);
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log("Payment log cleared successfully.");
    } catch (error) {
        console.error("Error clearing payment log: ", error);
        alert("حدث خطأ أثناء محاولة مسح السجل.");
    }
}


// --- UI RENDERING ---
function renderLogTable(logs) {
    logTableBody.innerHTML = "";
    if (logs.length === 0) {
        logTableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500 dark:text-gray-400">لا توجد دفعات مسجلة بعد.</td></tr>';
        return;
    }

    logs.forEach(log => {
        const date = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('ar-EG') : 'غير محدد';
        const row = `
            <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="p-3 font-semibold">${log.name}</td>
                <td class="p-3">${log.netAmount.toFixed(2)}</td>
                <td class="p-3">${date}</td>
            </tr>`;
        logTableBody.innerHTML += row;
    });
}


function renderLoggedInUI(user) {
    authContainer.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="font-semibold text-gray-700 dark:text-gray-300 hidden sm:block">${user.displayName || user.email}</span>
            <button id="signOutButton" class="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors">
                خروج
            </button>
        </div>
    `;
    document.getElementById("signOutButton").addEventListener("click", () => signOut(auth));
}

function renderLoggedOutUI() {
    authContainer.innerHTML = `
        <button id="googleSignInButton" class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-5 h-5">
            <span>تسجيل الدخول مع Google</span>
        </button>
    `;
    document.getElementById("googleSignInButton").addEventListener("click", () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(err => console.error(err));
    });
}


// --- INITIALIZE ---
initializeFirebase();
