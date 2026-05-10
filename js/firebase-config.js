import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDslTTv0JOw8Jll3qsLUMWfks2t5GQEYlI",
    authDomain: "irent-cfede.firebaseapp.com",
    projectId: "irent-cfede",
    storageBucket: "irent-cfede.firebasestorage.app",
    messagingSenderId: "750945286399",
    appId: "1:750945286399:web:aca795d5f0fe6faaca34ca",
    measurementId: "G-029L9Y7LKR"
};

let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase 初始化成功");
} catch (e) {
    console.error("Firebase 初始化失敗:", e);
}

export { db };
