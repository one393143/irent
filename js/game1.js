export function startGame() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 設定 Canvas 尺寸 (10x15 網格)
    const GRID_W = 10;
    const GRID_H = 15;
    const TS = 30; // 每格 30px
    canvas.width = GRID_W * TS;
    canvas.height = GRID_H * TS;
    
    // 遊戲狀態
    let isGameOver = false;
    let timer = 60;
    let revenue = 0;
    let satisfaction = 100;
    let freeDispatchers = 2;
    const maxDispatchers = 2;
    
    let lastTime = Date.now();
    let userSpawnTimer = Math.random() * 2 + 4; // 4-6 秒
    
    // DOM 元素
    const uiTimer = document.getElementById('game-timer');
    const uiRevenue = document.getElementById('game-revenue');
    const uiSatisfaction = document.getElementById('game-satisfaction');
    const uiDispatchers = document.getElementById('free-dispatchers');
    const modal = document.getElementById('settlement-modal');
    
    // 防呆：如果找不到 DOM 元素，不執行遊戲以免報錯
    if (!uiTimer || !uiRevenue || !uiSatisfaction || !uiDispatchers) {
        console.error("找不到計分板元素，遊戲未啟動。請確認 index.html 是否包含對應的 ID。");
        return;
    }
    
    // 初始化 UI
    uiTimer.innerText = timer;
    uiRevenue.innerText = `$${revenue}`;
    uiSatisfaction.innerText = `${satisfaction}%`;
    uiDispatchers.innerText = `${freeDispatchers}/${maxDispatchers}`;
    if (modal) modal.style.display = 'none';
    
    // 充電站位置
    const stations = [
        { x: 0, y: 0 },
        { x: 9, y: 14 }
    ];
    
    // 初始化 4 台機車
    let scooters = [];
    for (let i = 0; i < 4; i++) {
        scooters.push({
            id: i,
            x: Math.floor(Math.random() * GRID_W),
            y: Math.floor(Math.random() * GRID_H),
            battery: Math.floor(Math.random() * 51) + 50, // 50-100%
            state: 'idle', // idle, rented, dead, swapping
            targetX: -1,
            targetY: -1,
            deadTimer: 0,
            path: [],
            currentPathIndex: 0
        });
    }
    
    let users = [];
    let dispatchers = [];
    
    // 輔助函數：計算曼哈頓距離
    function getDistance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }
    
    // 輔助函數：生成直線路徑 (只走正交方向)
    function generatePath(startX, startY, endX, endY) {
        let path = [];
        let currX = startX;
        let currY = startY;
        
        // 先走 X 軸
        while (currX !== endX) {
            currX += (endX > currX) ? 1 : -1;
            path.push({ x: currX, y: currY });
        }
        // 再走 Y 軸
        while (currY !== endY) {
            currY += (endY > currY) ? 1 : -1;
            path.push({ x: currX, y: currY });
        }
        return path;
    }
    
    // 點擊事件
    canvas.addEventListener('click', (e) => {
        if (isGameOver) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        const gridX = Math.floor(clickX / TS);
        const gridY = Math.floor(clickY / TS);
        
        // 尋找被點擊的機車
        let clickedScooter = null;
        for (let s of scooters) {
            if (s.x === gridX && s.y === gridY) {
                clickedScooter = s;
                break;
            }
        }
        
        if (clickedScooter && (clickedScooter.state === 'idle' || clickedScooter.state === 'dead')) {
            if (freeDispatchers > 0) {
                // 找出最近的換電站
                let nearestStation = stations[0];
                let minDist = getDistance(clickedScooter.x, clickedScooter.y, nearestStation.x, nearestStation.y);
                
                for (let st of stations) {
                    let dist = getDistance(clickedScooter.x, clickedScooter.y, st.x, st.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestStation = st;
                    }
                }
                
                freeDispatchers--;
                uiDispatchers.innerText = `${freeDispatchers}/${maxDispatchers}`;
                
                // 建立調度員
                dispatchers.push({
                    x: nearestStation.x,
                    y: nearestStation.y,
                    targetScooter: clickedScooter,
                    state: 'going', // going, returning, charging
                    path: generatePath(nearestStation.x, nearestStation.y, clickedScooter.x, clickedScooter.y),
                    currentPathIndex: 0,
                    timer: 0,
                    station: nearestStation
                });
            }
        }
    });
    
    // 更新邏輯
    function update(dt) {
        if (isGameOver) return;
        
        // 倒數計時
        timer -= dt;
        if (timer <= 0) {
            timer = 0;
            endGame();
        }
        if (uiTimer) uiTimer.innerText = Math.ceil(timer);
        
        // 使用者生成邏輯
        userSpawnTimer -= dt;
        if (userSpawnTimer <= 0) {
            userSpawnTimer = Math.random() * 2 + 4; // 4-6 秒
            
            // 隨機在邊緣生成
            let edge = Math.floor(Math.random() * 4);
            let ux = 0, uy = 0;
            if (edge === 0) { ux = Math.floor(Math.random() * GRID_W); uy = 0; }
            else if (edge === 1) { ux = Math.floor(Math.random() * GRID_W); uy = GRID_H - 1; }
            else if (edge === 2) { ux = 0; uy = Math.floor(Math.random() * GRID_H); }
            else { ux = GRID_W - 1; uy = Math.floor(Math.random() * GRID_H); }
            
            users.push({
                x: ux,
                y: uy,
                targetScooter: null,
                state: 'seeking', // seeking, walking, angry
                path: [],
                currentPathIndex: 0,
                angryTimer: 0
            });
        }
        
        // 使用者 AI
        for (let i = users.length - 1; i >= 0; i--) {
            let u = users[i];
            
            if (u.state === 'seeking') {
                // 找最近的閒置機車
                let bestScooter = null;
                let minDist = 9999;
                for (let s of scooters) {
                    if (s.state === 'idle') {
                        let dist = getDistance(u.x, u.y, s.x, s.y);
                        if (dist < minDist) {
                            minDist = dist;
                            bestScooter = s;
                        }
                    }
                }
                
                if (bestScooter) {
                    u.targetScooter = bestScooter;
                    u.state = 'walking';
                    u.path = generatePath(u.x, u.y, bestScooter.x, bestScooter.y);
                    u.currentPathIndex = 0;
                } else {
                    // 客訴機制
                    u.state = 'angry';
                    u.angryTimer = 1; // 顯示生氣表情 1 秒
                    satisfaction = Math.max(0, satisfaction - 5);
                    if (uiSatisfaction) uiSatisfaction.innerText = `${satisfaction}%`;
                }
            } else if (u.state === 'walking') {
                u.angryTimer += dt;
                if (u.angryTimer >= 0.2) { // 模擬移動速度，0.2 秒走一格
                    u.angryTimer = 0;
                    if (u.currentPathIndex < u.path.length) {
                        let step = u.path[u.currentPathIndex];
                        u.x = step.x;
                        u.y = step.y;
                        u.currentPathIndex++;
                    } else {
                        // 抵達機車
                        if (u.targetScooter && u.targetScooter.state === 'idle') {
                            u.targetScooter.state = 'rented';
                            u.targetScooter.targetX = Math.floor(Math.random() * GRID_W);
                            u.targetScooter.targetY = Math.floor(Math.random() * GRID_H);
                            u.targetScooter.path = generatePath(u.targetScooter.x, u.targetScooter.y, u.targetScooter.targetX, u.targetScooter.targetY);
                            u.targetScooter.currentPathIndex = 0;
                        }
                        users.splice(i, 1); // 使用者消失
                    }
                }
            } else if (u.state === 'angry') {
                u.angryTimer -= dt;
                if (u.angryTimer <= 0) {
                    users.splice(i, 1);
                }
            }
        }
        
        // 機車與調度員邏輯
        for (let s of scooters) {
            if (s.state === 'rented') {
                s.deadTimer += dt;
                if (s.deadTimer >= 0.2) { // 0.2 秒走一格
                    s.deadTimer = 0;
                    if (s.currentPathIndex < s.path.length) {
                        let step = s.path[s.currentPathIndex];
                        s.x = step.x;
                        s.y = step.y;
                        s.currentPathIndex++;
                        
                        revenue += 10;
                        s.battery -= 5;
                        if (uiRevenue) uiRevenue.innerText = `$${revenue}`;
                        
                        if (s.battery <= 0) {
                            s.battery = 0;
                            s.state = 'dead';
                        }
                    } else {
                        s.state = 'idle';
                    }
                }
            } else if (s.state === 'dead') {
                s.deadTimer += dt;
                if (s.deadTimer >= 3) {
                    s.deadTimer = 0;
                    satisfaction = Math.max(0, satisfaction - 2);
                    if (uiSatisfaction) uiSatisfaction.innerText = `${satisfaction}%`;
                }
            }
        }
        
        // 調度員邏輯
        for (let i = dispatchers.length - 1; i >= 0; i--) {
            let d = dispatchers[i];
            
            if (d.state === 'going') {
                d.timer += dt;
                if (d.timer >= 0.15) { // 調度員稍微快一點，0.15 秒一格
                    d.timer = 0;
                    if (d.currentPathIndex < d.path.length) {
                        let step = d.path[d.currentPathIndex];
                        d.x = step.x;
                        d.y = step.y;
                        d.currentPathIndex++;
                    } else {
                        // 抵達機車
                        d.targetScooter.state = 'swapping';
                        d.state = 'returning';
                        d.path = generatePath(d.x, d.y, d.station.x, d.station.y);
                        d.currentPathIndex = 0;
                    }
                }
            } else if (d.state === 'returning') {
                d.timer += dt;
                if (d.timer >= 0.15) {
                    d.timer = 0;
                    if (d.currentPathIndex < d.path.length) {
                        let step = d.path[d.currentPathIndex];
                        d.x = step.x;
                        d.y = step.y;
                        d.targetScooter.x = step.x;
                        d.targetScooter.y = step.y;
                        d.currentPathIndex++;
                    } else {
                        // 抵達換電站
                        d.state = 'charging';
                        d.timer = 2; // 充電 2 秒
                    }
                }
            } else if (d.state === 'charging') {
                d.timer -= dt;
                if (d.timer <= 0) {
                    // 完成充電
                    d.targetScooter.battery = 100;
                    d.targetScooter.state = 'idle';
                    
                    // 隨機放在旁邊一格
                    const adj = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
                    let placed = false;
                    for (let a of adj) {
                        let nx = d.station.x + a.x;
                        let ny = d.station.y + a.y;
                        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                            d.targetScooter.x = nx;
                            d.targetScooter.y = ny;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        d.targetScooter.x = d.station.x;
                        d.targetScooter.y = d.station.y;
                    }
                    
                    freeDispatchers++;
                    if (uiDispatchers) uiDispatchers.innerText = `${freeDispatchers}/${maxDispatchers}`;
                    dispatchers.splice(i, 1);
                }
            }
        }
    }
    
    // 繪製邏輯
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. 畫背景
        for (let x = 0; x < GRID_W; x++) {
            for (let y = 0; y < GRID_H; y++) {
                // 判斷是否靠近換電站 (3x3)
                let isOrange = false;
                for (let s of stations) {
                    if (Math.abs(x - s.x) <= 1 && Math.abs(y - s.y) <= 1) {
                        isOrange = true;
                        break;
                    }
                }
                
                ctx.fillStyle = isOrange ? "rgba(255, 165, 0, 0.2)" : "rgba(144, 238, 144, 0.2)";
                ctx.fillRect(x * TS, y * TS, TS, TS);
                
                ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
                ctx.strokeRect(x * TS, y * TS, TS, TS);
            }
        }
        
        // 2. 畫換電站
        for (let s of stations) {
            ctx.fillStyle = "rgba(255, 165, 0, 0.8)";
            ctx.fillRect(s.x * TS, s.y * TS, TS, TS);
            ctx.fillStyle = "#fff";
            ctx.font = `${TS*0.8}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⚡", s.x * TS + TS/2, s.y * TS + TS/2);
        }
        
        // 3. 畫使用者
        for (let u of users) {
            ctx.font = `${TS*0.8}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (u.state === 'angry') {
                ctx.fillText("😡", u.x * TS + TS/2, u.y * TS + TS/2);
            } else {
                ctx.fillText("👤", u.x * TS + TS/2, u.y * TS + TS/2);
            }
        }
        
        // 4. 畫機車
        for (let s of scooters) {
            let text = "🛵";
            if (s.state === 'dead') {
                // 閃爍紅光
                if (Math.floor(Date.now() / 300) % 2 === 0) {
                    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
                    ctx.fillRect(s.x * TS, s.y * TS, TS, TS);
                }
            }
            
            ctx.font = `${TS*0.8}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, s.x * TS + TS/2, s.y * TS + TS/2);
            
            // 電量條
            const barW = TS * 0.8;
            const barH = 4;
            const barX = s.x * TS + (TS - barW)/2;
            const barY = s.y * TS + 2;
            
            ctx.fillStyle = "#ccc";
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = s.battery > 20 ? "lime" : "red";
            ctx.fillRect(barX, barY, barW * (s.battery/100), barH);
            
            // 狀態顏色圈
            ctx.beginPath();
            ctx.arc(s.x * TS + TS - 5, s.y * TS + 5, 4, 0, Math.PI*2);
            if (s.state === 'idle') ctx.fillStyle = "green";
            else if (s.state === 'rented') ctx.fillStyle = "blue";
            else if (s.state === 'dead') ctx.fillStyle = "red";
            else if (s.state === 'swapping') ctx.fillStyle = "yellow";
            ctx.fill();
        }
        
        // 5. 畫調度員
        for (let d of dispatchers) {
            ctx.font = `${TS*0.8}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("👷", d.x * TS + TS/2, d.y * TS + TS/2);
            
            if (d.state === 'charging') {
                // 充電閃爍
                if (Math.floor(Date.now() / 200) % 2 === 0) {
                    ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
                    ctx.fillRect(d.x * TS, d.y * TS, TS, TS);
                }
            }
        }
    }
    
    function endGame() {
        isGameOver = true;
        const finalRev = document.getElementById('final-revenue');
        const finalSat = document.getElementById('final-satisfaction');
        if (finalRev) finalRev.innerText = `$${revenue}`;
        if (finalSat) finalSat.innerText = `${satisfaction}%`;
        
        const evalText = document.getElementById('evaluation-text');
        if (evalText) {
            if (satisfaction < 60) {
                evalText.innerText = "客訴爆炸！您引發了公關危機！";
                evalText.style.color = "red";
            } else if (satisfaction >= 60 && revenue > 1000) {
                evalText.innerText = "完美調度大師！利潤與服務雙贏！";
                evalText.style.color = "gold";
            } else {
                evalText.innerText = "中規中矩的營運長，還有進步空間。";
                evalText.style.color = "black";
            }
        }
        
        if (modal) modal.style.display = 'block';
    }
    
    // 重新挑戰按鈕
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.onclick = () => {
            startGame();
        };
    }
    
    // 遊戲主迴圈
    function loop() {
        let now = Date.now();
        let dt = (now - lastTime) / 1000;
        lastTime = now;
        
        update(dt);
        draw();
        
        if (!isGameOver) {
            requestAnimationFrame(loop);
        }
    }
    
    requestAnimationFrame(loop);
}
