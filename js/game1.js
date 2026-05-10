export function startGame() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 動態設定 Canvas 尺寸
    const containerWidth = canvas.parentElement.clientWidth || window.innerWidth * 0.9;
    const size = Math.min(containerWidth, 600); // 最大不超過 600px
    canvas.width = size;
    canvas.height = size;
    
    const GRID = 32;
    const TS = size / GRID; // Tile Size (每個網格的像素大小)
    
    // 遊戲狀態變數
    let isGameOver = false;
    let timeAlive = 0;
    let deadCount = 0;
    let freeDispatchers = 3;
    let lastTime = Date.now();
    let startTime = Date.now();
    
    const uiTime = document.getElementById('game-time');
    const uiDead = document.getElementById('dead-scooters');
    const uiFreeDispatchers = document.getElementById('free-dispatchers');
    
    // 地圖設施
    const chargingStations = [
        { x: 16, y: 16 }, // 市中心
        { x: 5, y: 25 },  // 住宅區
        { x: 25, y: 5 }   // 商業區
    ];
    
    // 初始化 5 台機車
    let scooters = [];
    for (let i = 0; i < 5; i++) {
        scooters.push({
            id: i,
            x: Math.floor(Math.random() * (GRID - 4)) + 2, // 避免太靠邊緣
            y: Math.floor(Math.random() * (GRID - 4)) + 2,
            targetX: -1,
            targetY: -1,
            battery: 100,
            state: 'idle', // idle, moving, dead
            waitTimer: Math.random() * 2 // 隨機等待 0-2 秒後開始移動
        });
    }
    
    let activeDispatchers = [];
    
    // 點擊事件：調度換電
    canvas.addEventListener('click', (e) => {
        if (isGameOver) return;
        const rect = canvas.getBoundingClientRect();
        // 考慮到 canvas 在 css 中的 scale 或縮放，將點擊座標轉為 canvas 內部座標
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        
        // 尋找被點擊的機車 (判定範圍給大一點，方便手機點擊)
        let clickedScooter = null;
        const hitRadius = TS * 3; 
        for (let s of scooters) {
            let sx = s.x * TS;
            let sy = s.y * TS;
            if (Math.abs(clickX - sx) < hitRadius && Math.abs(clickY - sy) < hitRadius) {
                clickedScooter = s;
                break;
            }
        }
        
        // 若點到機車，且有空閒調度員，且機車電量未滿
        if (clickedScooter && freeDispatchers > 0 && clickedScooter.battery < 100) {
            // 找出最近的充電站派人
            let nearestStation = chargingStations[0];
            let minDist = 9999;
            for (let cs of chargingStations) {
                let dist = Math.abs(cs.x - clickedScooter.x) + Math.abs(cs.y - clickedScooter.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearestStation = cs;
                }
            }
            
            freeDispatchers--;
            uiFreeDispatchers.innerText = freeDispatchers;
            
            activeDispatchers.push({
                x: nearestStation.x,
                y: nearestStation.y,
                targetScooter: clickedScooter,
                state: 'going', // going 派往機車, returning 返回充電站
                station: nearestStation
            });
        }
    });
    
    // 更新邏輯
    function update(dt) {
        if (isGameOver) return;
        
        // 更新存活時間
        timeAlive = Math.floor((Date.now() - startTime) / 1000);
        uiTime.innerText = timeAlive;
        
        // 機車邏輯
        deadCount = 0;
        for (let s of scooters) {
            if (s.battery <= 0) {
                s.battery = 0;
                if (s.state !== 'dead') s.state = 'dead';
                deadCount++;
                continue;
            }
            
            // 待命中 -> 隨機啟動一趟租借
            if (s.state === 'idle') {
                s.waitTimer -= dt;
                if (s.waitTimer <= 0) {
                    s.state = 'moving';
                    s.targetX = Math.floor(Math.random() * (GRID - 2)) + 1;
                    s.targetY = Math.floor(Math.random() * (GRID - 2)) + 1;
                }
            } 
            // 移動中 (被人租走)
            else if (s.state === 'moving') {
                let speed = 4; // 每秒移動幾格
                let moveAmount = speed * dt;
                
                let dx = s.targetX - s.x;
                let dy = s.targetY - s.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < moveAmount) {
                    // 到達目的地
                    s.x = s.targetX;
                    s.y = s.targetY;
                    s.state = 'idle';
                    s.waitTimer = Math.random() * 4 + 2; // 抵達後閒置 2-6 秒
                } else {
                    // 沿直線移動
                    s.x += (dx/dist) * moveAmount;
                    s.y += (dy/dist) * moveAmount;
                }
                
                // 行駛中耗電：每秒掉 4%
                s.battery -= 4 * dt; 
            }
            // 就算閒置也會微幅耗電
            if (s.state === 'idle' && s.battery > 0) {
                s.battery -= 0.5 * dt;
            }
        }
        
        uiDead.innerText = deadCount;
        
        // 失敗條件判定：3 台車沒電
        if (deadCount >= 3) {
            isGameOver = true;
            setTimeout(() => {
                alert(`調度失敗！太多車輛沒電了。\n您的城市維持運作了：${timeAlive} 秒！`);
                // 重整頁面或回主畫面
            }, 500);
        }
        
        // 調度員邏輯
        for (let i = activeDispatchers.length - 1; i >= 0; i--) {
            let d = activeDispatchers[i];
            let speed = 12; // 調度員騎乘特殊車輛，速度比一般車快得多
            let moveAmount = speed * dt;
            
            if (d.state === 'going') {
                let targetX = d.targetScooter.x;
                let targetY = d.targetScooter.y;
                let dx = targetX - d.x;
                let dy = targetY - d.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < moveAmount) {
                    // 到達目標機車，幫機車充滿電！
                    d.x = targetX;
                    d.y = targetY;
                    d.targetScooter.battery = 100;
                    if (d.targetScooter.state === 'dead') {
                        // 復活機車
                        d.targetScooter.state = 'idle';
                        d.targetScooter.waitTimer = 1;
                    }
                    d.state = 'returning'; // 開始返回
                } else {
                    d.x += (dx/dist) * moveAmount;
                    d.y += (dy/dist) * moveAmount;
                }
            } else if (d.state === 'returning') {
                let targetX = d.station.x;
                let targetY = d.station.y;
                let dx = targetX - d.x;
                let dy = targetY - d.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < moveAmount) {
                    // 成功返回充電站，歸隊待命
                    activeDispatchers.splice(i, 1);
                    freeDispatchers++;
                    uiFreeDispatchers.innerText = freeDispatchers;
                } else {
                    d.x += (dx/dist) * moveAmount;
                    d.y += (dy/dist) * moveAmount;
                }
            }
        }
    }
    
    // 繪製畫面
    function draw() {
        ctx.clearRect(0, 0, size, size);
        
        // ==== 繪製分區背景顏色 ====
        // 學區 (左上)
        ctx.fillStyle = "rgba(100, 150, 255, 0.25)";
        ctx.fillRect(0, 0, 16*TS, 16*TS);
        
        // 商業區 (右上)
        ctx.fillStyle = "rgba(255, 100, 100, 0.25)";
        ctx.fillRect(16*TS, 0, 16*TS, 16*TS);
        
        // 住宅區 (左下)
        ctx.fillStyle = "rgba(100, 255, 100, 0.25)";
        ctx.fillRect(0, 16*TS, 16*TS, 16*TS);
        
        // (右下可保留為預設或工業區)
        ctx.fillStyle = "rgba(200, 200, 200, 0.25)";
        ctx.fillRect(16*TS, 16*TS, 16*TS, 16*TS);
        
        // 畫格線 (代表城市道路)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= GRID; i++) {
            ctx.moveTo(i*TS, 0); ctx.lineTo(i*TS, size);
            ctx.moveTo(0, i*TS); ctx.lineTo(size, i*TS);
        }
        ctx.stroke();
        
        // ==== 繪製特殊地標 ====
        // 捷運站
        ctx.fillStyle = "purple";
        [ [8,8], [24,24] ].forEach(pos => {
            ctx.beginPath();
            ctx.arc(pos[0]*TS, pos[1]*TS, TS*2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = `${TS*1.2}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🚇", pos[0]*TS, pos[1]*TS);
            ctx.fillStyle = "purple";
        });
        
        // 充電站
        chargingStations.forEach(cs => {
            ctx.fillStyle = "rgba(255, 165, 0, 0.8)"; // 橘黃色
            ctx.fillRect(cs.x*TS - TS*1.5, cs.y*TS - TS*1.5, TS*3, TS*3);
            ctx.fillStyle = "#fff";
            ctx.font = `${TS*1.5}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⚡", cs.x*TS, cs.y*TS);
        });
        
        // ==== 繪製調度員 ====
        for (let d of activeDispatchers) {
            ctx.fillStyle = "rgba(0, 0, 255, 0.8)";
            ctx.beginPath();
            ctx.arc(d.x*TS, d.y*TS, TS*1.2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = `${TS*1.5}px Arial`;
            ctx.fillText("👷", d.x*TS, d.y*TS);
        }
        
        // ==== 繪製機車 ====
        for (let s of scooters) {
            // 用 Emoji 畫車，並根據狀態加底色
            ctx.fillStyle = s.state === 'dead' ? "rgba(100,100,100,0.8)" : "rgba(0,166,90,0.8)";
            ctx.beginPath();
            ctx.arc(s.x*TS, s.y*TS, TS*1.5, 0, Math.PI*2);
            ctx.fill();
            
            ctx.font = `${TS*1.5}px Arial`;
            ctx.fillText("🛵", s.x*TS, s.y*TS);
            
            // 繪製電量條
            const barWidth = TS * 3;
            const barHeight = TS * 0.5;
            const barX = s.x*TS - barWidth/2;
            const barY = s.y*TS - TS*2;
            
            ctx.fillStyle = "red";
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // 根據電量變色
            if (s.battery > 50) ctx.fillStyle = "lime";
            else if (s.battery > 20) ctx.fillStyle = "yellow";
            else ctx.fillStyle = "orange";
            
            ctx.fillRect(barX, barY, barWidth * (Math.max(0, s.battery)/100), barHeight);
        }
    }
    
    // 主迴圈
    function loop() {
        if (!isGameOver) {
            let now = Date.now();
            let dt = (now - lastTime) / 1000; // 轉換為秒
            lastTime = now;
            
            update(dt);
            draw();
            
            requestAnimationFrame(loop);
        }
    }
    
    // 啟動迴圈
    requestAnimationFrame(loop);
}
