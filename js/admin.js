import { db } from './firebase-config.js';
import { doc, collection, onSnapshot, setDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// DOM 元素
const btnOpenJoin = document.getElementById('btn-open-join');
const btnStartGame = document.getElementById('btn-start-game');
const btnReset = document.getElementById('btn-reset');
const currentStatus = document.getElementById('current-status');

const adminPlayersList = document.getElementById('admin-players-list');
const adminPlayerCount = document.getElementById('admin-player-count');

// 初始化 QR Code (指向本地的 index.html)
// 使用者可以透過修改此處網址，或自動抓取目前網域
const currentUrl = window.location.href.replace('admin.html', 'index.html');
document.getElementById('url-display').innerText = currentUrl;

new QRCode(document.getElementById("qrcode"), {
    text: currentUrl,
    width: 200,
    height: 200,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
});

// 狀態參考
const gameStatusRef = doc(db, "gameData", "status");

// 監聽目前狀態
onSnapshot(gameStatusRef, (docSnap) => {
    let state = 'waiting_to_open';
    if (docSnap.exists()) {
        state = docSnap.data().state;
    }
    
    updateAdminUI(state);
}, (error) => {
    console.error("讀取狀態失敗", error);
    currentStatus.innerText = "Firebase 連線失敗";
    currentStatus.className = "status-badge waiting";
});

function updateAdminUI(state) {
    // 重置樣式
    currentStatus.className = "status-badge";
    btnOpenJoin.disabled = false;
    btnStartGame.disabled = false;
    btnReset.disabled = false;

    if (state === 'waiting_to_open') {
        currentStatus.innerText = "等待開放";
        currentStatus.classList.add("waiting");
        btnOpenJoin.disabled = false;
        btnStartGame.disabled = true;
    } else if (state === 'joinable') {
        currentStatus.innerText = "開放加入中";
        currentStatus.classList.add("joinable");
        btnOpenJoin.disabled = true;
        btnStartGame.disabled = false;
    } else if (state === 'playing') {
        currentStatus.innerText = "遊戲進行中";
        currentStatus.classList.add("playing");
        btnOpenJoin.disabled = true;
        btnStartGame.disabled = true;
    }
}

// 按鈕事件
btnOpenJoin.addEventListener('click', async () => {
    try {
        await setDoc(gameStatusRef, { state: 'joinable' });
    } catch (e) {
        console.error(e);
        alert('操作失敗，請確認 Firebase Rules 權限');
    }
});

btnStartGame.addEventListener('click', async () => {
    try {
        await setDoc(gameStatusRef, { state: 'playing' });
    } catch (e) {
        console.error(e);
    }
});

btnReset.addEventListener('click', async () => {
    if(!confirm("確定要重置遊戲嗎？這將清空所有玩家資料並回到等待狀態。")) return;
    
    try {
        // 1. 狀態改回等待
        await setDoc(gameStatusRef, { state: 'waiting_to_open' });
        
        // 2. 清空 players 集合
        const playersSnapshot = await getDocs(collection(db, "players"));
        const deletePromises = [];
        playersSnapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, "players", docSnap.id)));
        });
        await Promise.all(deletePromises);
        
        alert('遊戲已重置');
    } catch (e) {
        console.error(e);
    }
});

// 監聽玩家列表
const playersRef = collection(db, "players");
onSnapshot(playersRef, (snapshot) => {
    adminPlayersList.innerHTML = '';
    let count = 0;
    
    // 車子 icon 隨機顏色陣列 (模擬不同玩家)
    const icons = ['🚗', '🚕', '🚙', '🏎️', '🚐'];
    
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const card = document.createElement('div');
        card.className = 'player-card';
        
        // 給每個玩家隨機選一個車子 icon
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        
        card.innerHTML = `
            <div class="icon">${randomIcon}</div>
            <div class="name">${data.name}</div>
        `;
        adminPlayersList.appendChild(card);
        count++;
    });
    
    adminPlayerCount.innerText = count;
});
