import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  query,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig, appId } from "./firebase-config.js";

// --- GLOBAL VARIABLES & CONFIG ---
let people = []; // Local cache for people data
let expenses = []; // Local cache for expenses data

let db, auth;
let peopleUnsubscribe, expensesUnsubscribe;

// --- DOM ELEMENTS ---
const personNameInput = document.getElementById("personName");
const peopleListDiv = document.getElementById("peopleList");
const payerSelect = document.getElementById("payer");
const participantsDiv = document.getElementById("participants");
const expenseDescriptionInput = document.getElementById("expenseDescription");
const expenseAmountInput = document.getElementById("expenseAmount");
const expenseTableBody = document.getElementById("expenseTableBody");
const summaryTableBody = document.getElementById("summaryTableBody");
const messageArea = document.getElementById("messageArea");
const appIdDisplay = document.getElementById("appIdDisplay");
const authContainer = document.getElementById("auth-container");
const appContent = document.getElementById("app-content");
const authFormsContainer = document.getElementById("auth-forms-container");

// --- UTILITY FUNCTIONS ---
const disableButton = (btn) => btn.disabled = true;
const enableButton = (btn) => btn.disabled = false;

// --- DARK MODE ---
const toggleDarkMode = () => {
    const isDarkMode = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDarkMode);
};

const applyInitialDarkMode = () => {
    if (localStorage.getItem('darkMode') === 'true' || 
       (window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('darkMode'))) {
        document.documentElement.classList.add('dark');
    }
};

// --- AUTHENTICATION ---

const signInWithGoogle = async (event) => {
  disableButton(event.target);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Error signing in with Google:", error);
    showMessage(getFirebaseErrorMessage(error));
  }
};

const signOutUser = async (event) => {
  disableButton(event.target);
  await signOut(auth);
};

const handleSignUp = async (event) => {
    event.preventDefault();
    const signUpButton = event.target.querySelector('button[type="submit"]');
    disableButton(signUpButton);
    const email = event.target.email.value;
    const password = event.target.password.value;
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Error signing up:", error);
        showMessage(getFirebaseErrorMessage(error));
        enableButton(signUpButton);
    }
};

const handleSignIn = async (event) => {
    event.preventDefault();
    const signInButton = event.target.querySelector('button[type="submit"]');
    disableButton(signInButton);
    const email = event.target.email.value;
    const password = event.target.password.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Error signing in:", error);
        showMessage(getFirebaseErrorMessage(error));
        enableButton(signInButton);
    }
};

// --- FIREBASE INITIALIZATION & AUTH STATE CHANGES ---
async function initializeFirebase() {
  try {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
      showMessage("الرجاء تعبئة بيانات Firebase في ملف firebase-config.js");
      return;
    }

    const app = initializeApp(firebaseConfig);
    getAnalytics(app);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, (user) => {
      if (peopleUnsubscribe) peopleUnsubscribe();
      if (expensesUnsubscribe) expensesUnsubscribe();

      if (user) {
        console.log("User is signed in:", user.uid);
        renderLoggedInUI(user);
        setupFirestoreListeners(user.uid, appId);
      } else {
        console.log("User is signed out.");
        renderLoggedOutUI();
        people = [];
        expenses = [];
        render();
        authFormsContainer.classList.remove("hidden");
        appContent.classList.add("hidden");
      }
    });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    showMessage("فشل الاتصال بقاعدة البيانات. تأكد من صحة بياناتك في firebase-config.js");
  }
}

function setupFirestoreListeners(userId, currentAppId) {
  const peopleCollectionPath = `/users/${userId}/${currentAppId}/people`;
  const expensesCollectionPath = `/users/${userId}/${currentAppId}/expenses`;
  appIdDisplay.textContent = currentAppId;

  authFormsContainer.classList.add("hidden");
  appContent.classList.remove("hidden");
  
  const peopleQuery = query(collection(db, peopleCollectionPath));
  peopleUnsubscribe = onSnapshot(
    peopleQuery,
    (snapshot) => {
      people = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      console.log("People updated:", people);
      render();
    },
    (error) => {
      console.error("Error fetching people:", error.code, error.message);
      showMessage(`خطأ في جلب الأشخاص: ${error.code}`);
    }
  );

  const expensesQuery = query(collection(db, expensesCollectionPath));
  expensesUnsubscribe = onSnapshot(
    expensesQuery,
    (snapshot) => {
      expenses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      console.log("Expenses updated:", expenses);
      render();
    },
    (error) => {
      console.error("Error fetching expenses:", error.code, error.message);
      showMessage(`خطأ في جلب المصاريف: ${error.code}`);
    }
  );
}


// --- UI & RENDER FUNCTIONS ---

function renderLoggedInUI(user) {
    authContainer.innerHTML = `
        <div class="flex items-center gap-4">
            <button id="darkModeToggler" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <svg class="w-6 h-6 stroke-gray-800 dark:stroke-white block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                <svg class="w-6 h-6 stroke-gray-800 dark:stroke-white hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </button>
            <div class="flex items-center gap-3">
                ${user.photoURL ? `<img src="${user.photoURL}" alt="User Avatar" class="w-10 h-10 rounded-full">` : ''}
                <span class="font-semibold text-gray-700 hidden sm:block dark:text-gray-300">${user.displayName || user.email}</span>
                <button id="signOutButton" class="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors">
                    خروج
                </button>
            </div>
        </div>
    `;
    document.getElementById("signOutButton").addEventListener("click", signOutUser);
    document.getElementById("darkModeToggler").addEventListener("click", toggleDarkMode);
}

function renderLoggedOutUI() {
    authContainer.innerHTML = '';
    renderSignInForm();
}

function renderSignInForm() {
    authFormsContainer.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
            <h2 class="text-2xl font-bold text-center">تسجيل الدخول</h2>
            <form id="signInForm" class="space-y-4">
                <div>
                    <label for="signInEmail" class="block font-semibold mb-2">البريد الإلكتروني</label>
                    <input type="email" id="signInEmail" name="email" required autocomplete="email" class="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label for="signInPassword" class="block font-semibold mb-2">كلمة المرور</label>
                    <input type="password" id="signInPassword" name="password" required autocomplete="current-password" class="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <button type="submit" class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors">دخول</button>
            </form>
            <div class="text-center text-sm">
                <p>أو</p>
                <button id="googleSignInButton" class="w-full mt-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-5 h-5">
                    <span>المتابعة باستخدام Google</span>
                </button>
                <p class="mt-4">ليس لديك حساب؟ <a href="#" id="showSignUp" class="text-blue-600 dark:text-blue-400 hover:underline">أنشئ حسابًا جديدًا</a></p>
            </div>
        </div>
    `;
    document.getElementById("signInForm").addEventListener("submit", handleSignIn);
    document.getElementById("googleSignInButton").addEventListener("click", signInWithGoogle);
    document.getElementById("showSignUp").addEventListener("click", (e) => {
        e.preventDefault();
        renderSignUpForm();
    });
}

function renderSignUpForm() {
    authFormsContainer.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
            <h2 class="text-2xl font-bold text-center">إنشاء حساب جديد</h2>
            <form id="signUpForm" class="space-y-4">
                <div>
                    <label for="signUpEmail" class="block font-semibold mb-2">البريد الإلكتروني</label>
                    <input type="email" id="signUpEmail" name="email" required autocomplete="email" class="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label for="signUpPassword" class="block font-semibold mb-2">كلمة المرور</label>
                    <input type="password" id="signUpPassword" name="password" required autocomplete="new-password" class="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <button type="submit" class="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors">إنشاء حساب</button>
            </form>
            <div class="text-center text-sm">
                <p class="mt-4">لديك حساب بالفعل؟ <a href="#" id="showSignIn" class="text-blue-600 dark:text-blue-400 hover:underline">سجل الدخول</a></p>
            </div>
        </div>
    `;
    document.getElementById("signUpForm").addEventListener("submit", handleSignUp);
    document.getElementById("showSignIn").addEventListener("click", (e) => {
        e.preventDefault();
        renderSignInForm();
    });
}

function render() {
  renderPeopleList();
  renderPayerOptions();
  renderParticipantsCheckboxes();
  renderExpenseTable();
  renderSummaryTable();
}

function showMessage(text, isError = true) {
  messageArea.textContent = text;
  messageArea.className = `mt-4 text-center font-semibold ${isError ? 'text-red-500' : 'text-green-500'}`;
  if (text) {
    setTimeout(() => {
      messageArea.textContent = "";
    }, 4000);
  }
}

function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email': return 'البريد الإلكتروني غير صالح.';
        case 'auth/user-not-found': return 'لا يوجد حساب بهذا البريد الإلكتروني.';
        case 'auth/wrong-password': return 'كلمة المرور غير صحيحة.';
        case 'auth/email-already-in-use': return 'هذا البريد الإلكتروني مستخدم بالفعل.';
        case 'auth/weak-password': return 'كلمة المرور ضعيفة جدًا. يجب أن تتكون من 6 أحرف على الأقل.';
        case 'auth/requires-recent-login': return 'تتطلب هذه العملية إعادة تسجيل الدخول.';
        case 'permission-denied': return 'ليس لديك الصلاحية للقيام بهذا الإجراء.';
        default: return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
    }
}

// --- CORE LOGIC FUNCTIONS ---

window.addPerson = async function (event) {
  const btn = event.target;
  disableButton(btn);
  const name = personNameInput.value.trim();
  const user = auth.currentUser;
  if (!user) {
    showMessage("يجب تسجيل الدخول أولاً.");
    enableButton(btn);
    return;
  }
  if (name && !people.some((p) => p.name === name)) {
    try {
      await addDoc(collection(db, `/users/${user.uid}/${appId}/people`), { name });
      personNameInput.value = "";
      showMessage("تمت إضافة الشخص بنجاح!", false);
    } catch (error) {
      console.error("Error adding person: ", error);
      showMessage(getFirebaseErrorMessage(error));
    }
  } else if (people.some((p) => p.name === name)) {
    showMessage("هذا الشخص موجود بالفعل.");
  }
  enableButton(btn);
};

window.deletePerson = async function (id) {
  const personToDelete = people.find((p) => p.id === id);
  if (!personToDelete) return;
  const isUsed = expenses.some((e) => e.payer === personToDelete.name || e.participants.includes(personToDelete.name));
  if (isUsed) {
    showMessage(`لا يمكن حذف "${personToDelete.name}" لأنه مسجل في بعض المصاريف.`);
    return;
  }
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, `/users/${user.uid}/${appId}/people`, id));
    showMessage("تم حذف الشخص.", false);
  } catch (error) {
    console.error("Error deleting person: ", error);
    showMessage(getFirebaseErrorMessage(error));
  }
};

window.addExpense = async function (event) {
  const btn = event.target;
  disableButton(btn);
  const description = expenseDescriptionInput.value.trim();
  const amount = parseFloat(expenseAmountInput.value);
  const payer = payerSelect.value;
  const participantNodes = participantsDiv.querySelectorAll('input[type="checkbox"]:checked');
  const participants = Array.from(participantNodes).map((node) => node.value);

  if (!description || !amount || !payer || participants.length === 0 || amount <= 0) {
    showMessage("الرجاء ملء جميع الحقول بشكل صحيح.");
    enableButton(btn);
    return;
  }

  const expense = { description, amount, payer, participants, createdAt: new Date() };
  const user = auth.currentUser;
  if (!user) {
    enableButton(btn);
    return;
  }

  try {
    await addDoc(collection(db, `/users/${user.uid}/${appId}/expenses`), expense);
    expenseDescriptionInput.value = "";
    expenseAmountInput.value = "";
    payerSelect.selectedIndex = 0;
    participantNodes.forEach((node) => (node.checked = false));
    showMessage("تم تسجيل المصروف بنجاح!", false);
  } catch (error) {
    console.error("Error adding expense: ", error);
    showMessage(getFirebaseErrorMessage(error));
  } finally {
    enableButton(btn);
  }
};

window.deleteExpense = async function (id) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, `/users/${user.uid}/${appId}/expenses`, id));
    showMessage("تم حذف المصروف.", false);
  } catch (error) {
    console.error("Error deleting expense: ", error);
    showMessage(getFirebaseErrorMessage(error));
  }
};

// --- EVENT LISTENERS BINDING ---
document.querySelector('#personName').addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
      event.preventDefault();
      document.querySelector('button[onclick="addPerson()"]').click();
  }
});
document.querySelector('button[onclick="addPerson()"]').addEventListener('click', window.addPerson);
document.querySelector('button[onclick="addExpense()"]').addEventListener('click', window.addExpense);


// --- RENDER FUNCTIONS (Reading from local cache) ---

function renderPeopleList() {
  peopleListDiv.innerHTML = "";
  if (!people || people.length === 0) return;
  people.forEach((person) => {
    const personTag = `
      <div class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-full px-4 py-2 flex items-center gap-2">
        <span>${person.name}</span>
        <button onclick="deletePerson('${person.id}')" class="text-red-500 hover:text-red-700 font-bold leading-none" aria-label="Delete ${person.name}">&times;</button>
      </div>`;
    peopleListDiv.innerHTML += personTag;
  });
}

function renderPayerOptions() {
  const currentValue = payerSelect.value;
  payerSelect.innerHTML = '<option value="" disabled>اختر من دفع</option>';
  people.forEach((person) => {
    const option = `<option value="${person.name}">${person.name}</option>`;
    payerSelect.innerHTML += option;
  });
  if (people.find(p => p.name === currentValue)) {
    payerSelect.value = currentValue;
  } else {
    payerSelect.value = "";
  }
}

function renderParticipantsCheckboxes() {
  participantsDiv.innerHTML = "";
  if (people.length === 0) {
    participantsDiv.innerHTML = '<p class="text-gray-500 dark:text-gray-400">الرجاء إضافة أشخاص أولاً.</p>';
    return;
  }
  people.forEach((person) => {
    const checkbox = `
      <label class="flex items-center space-x-3 space-x-reverse p-1 cursor-pointer">
        <input type="checkbox" value="${person.name}" class="form-checkbox h-5 w-5 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-blue-500 rtl-form-checkbox">
        <span class="text-gray-700 dark:text-gray-300">${person.name}</span>
      </label>`;
    participantsDiv.innerHTML += checkbox;
  });
}

function renderExpenseTable() {
  expenseTableBody.innerHTML = "";
  if (expenses.length === 0) {
    expenseTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 dark:text-gray-400">لا توجد مصاريف مسجلة بعد.</td></tr>';
    return;
  }
  const sortedExpenses = [...expenses].sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
  sortedExpenses.forEach((expense) => {
    const row = `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="p-3">${expense.description}</td>
        <td class="p-3">${expense.amount.toFixed(2)}</td>
        <td class="p-3">${expense.payer}</td>
        <td class="p-3 text-sm">${expense.participants.join(", ")}</td>
        <td class="p-3 text-center">
            <button onclick="deleteExpense('${expense.id}')" class="text-red-500 hover:text-red-700 text-2xl leading-none" aria-label="Delete expense">&times;</button>
        </td>
      </tr>`;
    expenseTableBody.innerHTML += row;
  });
}

function renderSummaryTable() {
  summaryTableBody.innerHTML = "";
  if (people.length === 0) {
    summaryTableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500 dark:text-gray-400">أضف الأشخاص لعرض الملخص.</td></tr>';
    return;
  }

  const summary = {};
  people.forEach((person) => {
    summary[person.name] = { paid: 0, share: 0, net: 0 };
  });

  expenses.forEach((expense) => {
    if (summary[expense.payer]) {
      summary[expense.payer].paid += expense.amount;
    }
    const shareAmount = expense.participants.length > 0 ? expense.amount / expense.participants.length : 0;
    expense.participants.forEach((participantName) => {
      if (summary[participantName]) {
        summary[participantName].share += shareAmount;
      }
    });
  });

  Object.keys(summary).forEach((personName) => {
    const data = summary[personName];
    data.net = data.paid - data.share;
    const netClass = data.net >= 0 ? "summary-positive" : "summary-negative";
    const row = `
      <tr class="border-b dark:border-gray-700">
        <td class="p-3 font-semibold">${personName}</td>
        <td class="p-3">${data.paid.toFixed(2)}</td>
        <td class="p-3">${data.share.toFixed(2)}</td>
        <td class="p-3 font-bold text-lg ${netClass}">${data.net.toFixed(2)}</td>
      </tr>`;
    summaryTableBody.innerHTML += row;
  });
}

// --- INITIALIZE THE APP ---
applyInitialDarkMode();
initializeFirebase();
