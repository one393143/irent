import { db } from './firebase-config.js';
import { doc, collection, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { startGame } from './game1.js';

// DOM 元素
const views = {
    login: document.getElementById('login-view'),
    waiting: document.getElementById('waiting-view'),
    game: document.getElementById('game-view')
};

const statusText = document.getElementById('status-text');
const nicknameInput = document.getElementById('nickname-input');
const joinBtn = document.getElementById('join-btn');
const playersList = document.getElementById('players-list');
const playerCount = document.getElementById('player-count');
const myNameDisplay = document.getElementById('my-name-display');

// 遊戲狀態與個人資料
let currentState = 'waiting_to_open';
let myNickname = '';
let myPlayerId = '';
let gameStarted = false;

// 切換畫面
function showView(viewId) {
    Object.values(views).forEach(v => v.classList.remove('active-view'));
    views[viewId].classList.add('active-view');
}

// 監聽遊戲狀態 (host 控制)
const gameStatusRef = doc(db, "gameData", "status");
onSnapshot(gameStatusRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        handleStateChange(data.state);
    } else {
        // 如果還沒有這個 document，先當作未開放
        handleStateChange('waiting_to_open');
    }
}, (error) => {
    console.error("讀取狀態失敗，請確認 Firebase 設定與 Rules", error);
    statusText.innerText = "連線失敗，請檢查設定";
});

function handleStateChange(state) {
    currentState = state;
    if (state === 'waiting_to_open') {
        if (!myPlayerId) {
            showView('login');
            statusText.innerText = '請等待主持人開放加入';
            nicknameInput.disabled = true;
            joinBtn.disabled = true;
        }
    } else if (state === 'joinable') {
        if (!myPlayerId) {
            showView('login');
            statusText.innerText = '開放加入中！請輸入暱稱';
            nicknameInput.disabled = false;
            joinBtn.disabled = false;
        } else {
            showView('waiting');
        }
    } else if (state === 'playing') {
        if (myPlayerId) {
            showView('game');
            if (!gameStarted) {
                startGame();
                gameStarted = true;
            }
        } else {
            statusText.innerText = '遊戲已開始，無法加入';
            nicknameInput.disabled = true;
            joinBtn.disabled = true;
        }
    }
}

// 加入遊戲
joinBtn.addEventListener('click', async () => {
    const name = nicknameInput.value.trim();
    if (!name) return;
    
    myNickname = name;
    myPlayerId = "player_" + Date.now() + "_" + Math.floor(Math.random()*1000);
    
    joinBtn.disabled = true;
    joinBtn.innerText = "加入中...";
    
    try {
        await setDoc(doc(db, "players", myPlayerId), {
            name: myNickname,
            joinedAt: serverTimestamp()
        });
        
        myNameDisplay.innerText = myNickname;
        showView('waiting');
    } catch (error) {
        console.error("加入失敗", error);
        alert("加入失敗，請重試！");
        joinBtn.disabled = false;
        joinBtn.innerText = "確認加入";
    }
});

// 監聽其他玩家加入
const playersRef = collection(db, "players");
onSnapshot(playersRef, (snapshot) => {
    playersList.innerHTML = '';
    let count = 0;
    
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const li = document.createElement('li');
        li.innerText = data.name;
        // 如果是自己，可以加上標記
        if (docSnap.id === myPlayerId) {
            li.style.color = 'var(--primary-color)';
        }
        playersList.appendChild(li);
        count++;
    });
    
    playerCount.innerText = count;
});

// Enter 鍵快捷加入
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !joinBtn.disabled) {
        joinBtn.click();
    }
});
