// --- Firebase Imports ---
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
  updateDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let people = [];
let expenses = [];
let db, auth;
let peopleUnsubscribe, expensesUnsubscribe;
let currentSummary = {};

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
const authContainer = document.getElementById("auth-container");
const appContent = document.getElementById("app-content");
const authFormsContainer = document.getElementById("auth-forms-container");
const resetPaidStatusBtn = document.getElementById("resetPaidStatusBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");

// --- UTILITY FUNCTIONS ---
const disableButton = (btn) => {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
};
const enableButton = (btn) => {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
};

// --- PDF GENERATION ---
async function downloadInvoice() {
    if (Object.keys(currentSummary).length === 0) {
        showMessage("لا يوجد بيانات في الملخص لإنشاء فاتورة.", true);
        return;
    }

    disableButton(downloadPdfBtn);
    showMessage("جاري تحضير الفاتورة...", false);

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Fetch font from the correct path
        const fontResponse = await fetch('Assets/Fonts/Amiri/Amiri-Regular.ttf');
        if (!fontResponse.ok) throw new Error("Failed to load font file from Assets/Fonts/Amiri/");
        const font = await fontResponse.arrayBuffer();
        const fontBase64 = btoa(new Uint8Array(font).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        // Register the Amiri font with jsPDF
        doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');

        doc.setR2L(true); // Enable Right-to-Left text direction

        doc.setFontSize(20);
        doc.text("ملخص الفاتورة", 105, 15, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`, 105, 22, { align: 'center' });
        
        const tableColumn = ["الصافي", "ما عليه", "ما دفعه", "الشخص"];
        const tableRows = [];

        Object.keys(currentSummary).forEach(personName => {
            const data = currentSummary[personName];
            const row = [
                data.net.toFixed(2),
                data.share.toFixed(2),
                data.paid.toFixed(2),
                personName,
            ];
            tableRows.push(row);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: {
                halign: 'center',
                fillColor: [22, 160, 133],
                font: 'Amiri',
                fontStyle: 'normal'
            },
            bodyStyles: {
                halign: 'center',
                font: 'Amiri',
                fontStyle: 'normal'
            },
            didParseCell: function (data) {
                // To handle RTL text correctly in each cell
                data.cell.text = data.cell.text.map(str => str.split('').reverse().join(''));
            }
        });

        doc.save('فاتورة_المصاريف.pdf');
        showMessage("تم تنزيل الفاتورة بنجاح!", false);

    } catch (error) {
        console.error("PDF generation failed:", error);
        showMessage("حدث خطأ أثناء إنشاء الفاتورة.", true);
    } finally {
        enableButton(downloadPdfBtn);
    }
}


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
  } finally {
      enableButton(event.target);
  }
};

const signOutUser = async (event) => {
  disableButton(event.target);
  await signOut(auth);
  // The button will be removed from the DOM, no need to re-enable
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

// --- FIREBASE INITIALIZATION & DATA HANDLING ---
async function initializeFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    getAnalytics(app);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, (user) => {
      if (peopleUnsubscribe) peopleUnsubscribe();
      if (expensesUnsubscribe) expensesUnsubscribe();

      if (user) {
        renderLoggedInUI(user);
        setupFirestoreListeners(user.uid);
        resetPaidStatusBtn.onclick = () => resetAllPaidStatuses(user.uid);
        downloadPdfBtn.onclick = downloadInvoice;
      } else {
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
    showMessage("فشل الاتصال بقاعدة البيانات.");
  }
}

function setupFirestoreListeners(userId) {
  const peopleCollectionPath = `users/${userId}/people`;
  const expensesCollectionPath = `users/${userId}/expenses`;

  authFormsContainer.classList.add("hidden");
  appContent.classList.remove("hidden");
  
  const peopleQuery = query(collection(db, peopleCollectionPath));
  peopleUnsubscribe = onSnapshot(peopleQuery, (snapshot) => {
      people = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      render();
    }, (error) => {
      console.error("Error fetching people:", error);
      showMessage(getFirebaseErrorMessage(error));
    }
  );

  const expensesQuery = query(collection(db, expensesCollectionPath));
  expensesUnsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      expenses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      render();
    }, (error) => {
      console.error("Error fetching expenses:", error);
      showMessage(getFirebaseErrorMessage(error));
    }
  );
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
      await addDoc(collection(db, `users/${user.uid}/people`), { name, paid: false });
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
  const user = auth.currentUser;
  if (!user) return;
  
  const personToDelete = people.find((p) => p.id === id);
  if (!personToDelete) return;

  const isUsed = expenses.some((e) => e.payer === personToDelete.name || e.participants.includes(personToDelete.name));
  if (isUsed) {
    showMessage(`لا يمكن حذف "${personToDelete.name}" لأنه مسجل في بعض المصاريف.`);
    return;
  }

  try {
    await deleteDoc(doc(db, `users/${user.uid}/people`, id));
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
    await addDoc(collection(db, `users/${user.uid}/expenses`), expense);
    await resetAllPaidStatuses(user.uid, false); 
    expenseDescriptionInput.value = "";
    expenseAmountInput.value = "";
    payerSelect.selectedIndex = 0;
    participantNodes.forEach((node) => (node.checked = false));
    showMessage("تم تسجيل المصروف وإعادة تعيين الحالات.", false);
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
    await deleteDoc(doc(db, `users/${user.uid}/expenses`, id));
    showMessage("تم حذف المصروف.", false);
  } catch (error) {
    console.error("Error deleting expense: ", error);
    showMessage(getFirebaseErrorMessage(error));
  }
};

window.confirmPayment = async function (personId) {
    const user = auth.currentUser;
    if (!user) return;

    const person = people.find(p => p.id === personId);
    if (!person) return;
    
    const summaryData = currentSummary[person.name];
    if (!summaryData) {
        showMessage("لا يمكن العثور على بيانات الملخص للشخص.", true);
        return;
    }

    const personRef = doc(db, `users/${user.uid}/people`, personId);
    const logRef = collection(db, `users/${user.uid}/payment_log`);

    try {
        const batch = writeBatch(db);
        batch.update(personRef, { paid: true });
        batch.set(doc(logRef), {
            name: person.name,
            netAmount: summaryData.net,
            timestamp: serverTimestamp()
        });
        await batch.commit();
        showMessage(`تم تأكيد الدفع لـ ${person.name} وتسجيله.`, false);
    } catch (error) {
        console.error("Error confirming payment: ", error);
        showMessage(getFirebaseErrorMessage(error));
    }
};

async function resetAllPaidStatuses(userId, confirmReset = true) {
    if (confirmReset && !confirm("هل أنت متأكد أنك تريد إعادة تعيين كل حالات الدفع إلى 'لم يدفع'؟")) {
        return;
    }
    const batch = writeBatch(db);
    people.forEach(person => {
        const personRef = doc(db, `users/${userId}/people`, person.id);
        batch.update(personRef, { paid: false });
    });
    try {
        await batch.commit();
        if(confirmReset) showMessage("تم إعادة تعيين كل الحالات بنجاح.", false);
    } catch (error) {
        console.error("Error resetting paid statuses: ", error);
        showMessage(getFirebaseErrorMessage(error));
    }
}


// --- UI RENDER FUNCTIONS ---

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
    document.getElementById("showSignUp").addEventListener("click", (e) => { e.preventDefault(); renderSignUpForm(); });
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
    document.getElementById("showSignIn").addEventListener("click", (e) => { e.preventDefault(); renderSignInForm(); });
}

function render() {
  renderPeopleList();
  renderPayerOptions();
  renderParticipantsCheckboxes();
  renderExpenseTable();
  calculateAndRenderSummaryTable();
}

function showMessage(text, isError = true) {
  messageArea.textContent = text;
  messageArea.className = `mt-4 text-center font-semibold ${isError ? 'text-red-500' : 'text-green-500'}`;
  if (text) { setTimeout(() => { messageArea.textContent = ""; }, 4000); }
}

function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email': return 'البريد الإلكتروني غير صالح.';
        case 'auth/user-not-found': return 'لا يوجد حساب بهذا البريد الإلكتروني.';
        case 'auth/wrong-password': return 'كلمة المرور غير صحيحة.';
        case 'auth/email-already-in-use': return 'هذا البريد الإلكتروني مستخدم بالفعل.';
        case 'auth/weak-password': return 'كلمة المرور ضعيفة جدًا.';
        case 'permission-denied': return 'تم رفض الإذن. تحقق من قواعد الأمان في Firestore.';
        default: return `حدث خطأ غير متوقع: ${error.message}`;
    }
}

// Event Listeners
document.querySelector('#personName').addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.querySelector('button[onclick="addPerson()"]').click();
  }
});
document.querySelector('button[onclick="addPerson()"]').addEventListener('click', window.addPerson);
document.querySelector('button[onclick="addExpense()"]').addEventListener('click', window.addExpense);


function renderPeopleList() {
  peopleListDiv.innerHTML = "";
  if (!people || people.length === 0) return;
  people.forEach((person) => {
    const personTag = `<div class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-full px-4 py-2 flex items-center gap-2"><span>${person.name}</span><button onclick="deletePerson('${person.id}')" class="text-red-500 hover:text-red-700 font-bold leading-none" aria-label="Delete ${person.name}">&times;</button></div>`;
    peopleListDiv.innerHTML += personTag;
  });
}

function renderPayerOptions() {
  const currentValue = payerSelect.value;
  payerSelect.innerHTML = '<option value="" disabled selected>اختر من دفع</option>';
  people.forEach((person) => {
    const option = `<option value="${person.name}">${person.name}</option>`;
    payerSelect.innerHTML += option;
  });
  if (people.find(p => p.name === currentValue)) {
    payerSelect.value = currentValue;
  }
}

function renderParticipantsCheckboxes() {
  participantsDiv.innerHTML = "";
  if (people.length === 0) {
    participantsDiv.innerHTML = '<p class="text-gray-500 dark:text-gray-400">الرجاء إضافة أشخاص أولاً.</p>';
    return;
  }
  people.forEach((person) => {
    const checkbox = `<label class="flex items-center space-x-3 space-x-reverse p-1 cursor-pointer"><input type="checkbox" value="${person.name}" class="form-checkbox h-5 w-5 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-blue-500 rtl-form-checkbox"><span class="text-gray-700 dark:text-gray-300">${person.name}</span></label>`;
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
    const row = `<tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"><td class="p-3">${expense.description}</td><td class="p-3">${expense.amount.toFixed(2)}</td><td class="p-3">${expense.payer}</td><td class="p-3 text-sm">${expense.participants.join(", ")}</td><td class="p-3 text-center"><button onclick="deleteExpense('${expense.id}')" class="text-red-500 hover:text-red-700 text-2xl leading-none" aria-label="Delete expense">&times;</button></td></tr>`;
    expenseTableBody.innerHTML += row;
  });
}

function calculateAndRenderSummaryTable() {
    summaryTableBody.innerHTML = "";
    if (people.length === 0) {
        summaryTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 dark:text-gray-400">أضف الأشخاص لعرض الملخص.</td></tr>';
        return;
    }

    const summary = {};
    people.forEach((person) => {
        summary[person.name] = { id: person.id, paid: 0, share: 0, net: 0, hasPaid: person.paid };
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
    
    currentSummary = summary;

    Object.keys(summary).forEach((personName) => {
        const data = summary[personName];
        data.net = data.paid - data.share;

        const netClass = data.net >= 0 ? "summary-positive" : "summary-negative";
        
        let statusCell;
        if (data.hasPaid) {
            statusCell = `<span class="text-green-500 font-semibold">تم الدفع</span>`;
        } else {
            statusCell = `<button onclick="confirmPayment('${data.id}')" 
                                  class="text-white font-bold py-1 px-2 rounded-lg text-xs transition-colors bg-green-500 hover:bg-green-600">
                              تأكيد الدفع
                          </button>`;
        }

        const row = `
            <tr class="border-b dark:border-gray-700">
                <td class="p-3 font-semibold">${personName}</td>
                <td class="p-3">${data.paid.toFixed(2)}</td>
                <td class="p-3">${data.share.toFixed(2)}</td>
                <td class="p-3 font-bold text-lg ${netClass}">${data.net.toFixed(2)}</td>
                <td class="p-3 text-center">${statusCell}</td>
            </tr>`;
        summaryTableBody.innerHTML += row;
    });
}


// --- INITIALIZE THE APP ---
applyInitialDarkMode();
initializeFirebase();
