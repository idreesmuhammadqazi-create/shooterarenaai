// HUD.js - COD Tactical First-Person HUD, Dynamic Crosshair, Minimap, Compass, and Overlay Effects
import * as THREE from 'three';

export class HUD {
  constructor(gameManager) {
    this.gm = gameManager;
    this.hitmarkerTimer = 0;
    this.hitmarkerHeadshot = false;
    this.hitmarkerKill = false;

    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    this.radarSweepAngle = 0;

    this.compassCanvas = document.getElementById('compass-canvas');
    this.compassCtx = this.compassCanvas ? this.compassCanvas.getContext('2d') : null;

    this.initHUD();
  }

  initHUD() {
    // Setup keybindings for killstreaks (keys 3, 4, 5, 6)
    window.addEventListener('keydown', (e) => {
      if (this.gm.gameState !== 'playing' || this.gm.player.isDead) return;

      if (e.key === '3') {
        this.gm.killstreaks.activateUAV();
      } else if (e.key === '4') {
        this.gm.killstreaks.activateAirstrike(this.gm.player.pos, this.gm.cameraRig.getForwardDirection());
      } else if (e.key === '5') {
        this.gm.killstreaks.activateChopper();
      } else if (e.key === '6') {
        this.gm.killstreaks.activateNuke(() => this.gm.detonateNuke());
      }
    });
  }

  showHitmarker(isHeadshot = false, isKill = false) {
    this.hitmarkerTimer = 0.25;
    this.hitmarkerHeadshot = isHeadshot;
    this.hitmarkerKill = isKill;
  }

  renderMinimap(player, enemies, killstreaks, mapSize = 40) {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const center = w / 2;
    const scale = (w * 0.45) / mapSize;

    ctx.clearRect(0, 0, w, h);

    // Dark tactical radar background
    ctx.fillStyle = 'rgba(10, 16, 12, 0.75)';
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Range rings
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
    ctx.beginPath();
    ctx.arc(center, center, center * 0.5, 0, Math.PI * 2);
    ctx.arc(center, center, center * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // Radar Sweep Line
    this.radarSweepAngle += 0.05;
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.radarSweepAngle);
    const grad = ctx.createLinearGradient(0, 0, center, 0);
    grad.addColorStop(0, 'rgba(0, 255, 136, 0.0)');
    grad.addColorStop(1, 'rgba(0, 255, 136, 0.4)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, center - 4, 0, Math.PI / 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw Enemies (Show if UAV active or when firing)
    for (const e of enemies) {
      if (e.isDead) continue;
      const relX = (e.pos.x - player.pos.x) * scale;
      const relZ = (e.pos.z - player.pos.z) * scale;

      const distSq = relX * relX + relZ * relZ;
      if (distSq < (center - 6) * (center - 6)) {
        const isVisible = killstreaks.uavActive || (e.burstShotsRemaining > 0);
        if (isVisible) {
          ctx.fillStyle = (e.type === 'heavy') ? '#ff2222' : '#ff4444';
          ctx.beginPath();
          ctx.arc(center + relX, center + relZ, (e.type === 'heavy') ? 4.5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw Player Arrow at Center
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-this.gm.cameraRig.yaw + Math.PI);
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderCompass(playerYaw, enemies, playerPos) {
    if (!this.compassCtx) return;
    const ctx = this.compassCtx;
    const w = this.compassCanvas.width;
    const h = this.compassCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Degree Marks & Cardinal Points
    const yawDeg = ((playerYaw * (180 / Math.PI)) % 360 + 360) % 360;
    const centerX = w / 2;

    const cardinals = [
      { deg: 0, text: 'N' },
      { deg: 45, text: 'NE' },
      { deg: 90, text: 'E' },
      { deg: 135, text: 'SE' },
      { deg: 180, text: 'S' },
      { deg: 225, text: 'SW' },
      { deg: 270, text: 'W' },
      { deg: 315, text: 'NW' }
    ];

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let d = 0; d < 360; d += 15) {
      let diff = d - yawDeg;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      const x = centerX + diff * 2.2;
      if (x >= 0 && x <= w) {
        const card = cardinals.find(c => c.deg === d);
        if (card) {
          ctx.fillStyle = '#00ff88';
          ctx.fillText(card.text, x, h / 2);
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillRect(x, h / 2 - 2, 1, 5);
        }
      }
    }

    // Hostile Bearing Indicators
    for (const e of enemies) {
      if (e.isDead) continue;
      const dir = new THREE.Vector3().subVectors(e.pos, playerPos);
      const enemyAngle = (Math.atan2(dir.x, dir.z) * (180 / Math.PI) + 180) % 360;

      let diff = enemyAngle - yawDeg;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      const x = centerX + diff * 2.2;
      if (x >= 10 && x <= w - 10) {
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.moveTo(x, h - 3);
        ctx.lineTo(x - 3, h - 8);
        ctx.lineTo(x + 3, h - 8);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Center Heading Triangle
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.moveTo(centerX, 2);
    ctx.lineTo(centerX - 4, 8);
    ctx.lineTo(centerX + 4, 8);
    ctx.closePath();
    ctx.fill();
  }

  update(dt) {
    const gm = this.gm;
    const player = gm.player;
    const weapon = gm.weaponSystem.getCurrentWeapon();
    const data = weapon.data;
    const score = gm.scoreManager;
    const streaks = gm.killstreaks;

    // 1. Dynamic Crosshair
    const crosshair = document.getElementById('crosshair');
    const isADS = player.keys.ads;
    if (crosshair) {
      if (isADS) {
        crosshair.style.opacity = '0';
      } else {
        crosshair.style.opacity = '1';
        const spreadPixels = Math.min(48, Math.max(10, gm.weaponSystem.currentSpread * 600));
        crosshair.style.setProperty('--crosshair-gap', `${spreadPixels}px`);
      }
    }

    // Hitmarker display
    const hitmarkerEl = document.getElementById('hitmarker');
    if (hitmarkerEl) {
      if (this.hitmarkerTimer > 0) {
        this.hitmarkerTimer -= dt;
        hitmarkerEl.style.opacity = '1';
        hitmarkerEl.style.transform = 'translate(-50%, -50%) scale(1.1)';
        hitmarkerEl.className = this.hitmarkerKill ? 'hitmarker kill' : (this.hitmarkerHeadshot ? 'hitmarker headshot' : 'hitmarker');
      } else {
        hitmarkerEl.style.opacity = '0';
        hitmarkerEl.style.transform = 'translate(-50%, -50%) scale(0.8)';
      }
    }

    // Sniper Scope Overlay
    const scopeOverlay = document.getElementById('sniper-scope');
    if (scopeOverlay) {
      scopeOverlay.style.display = (isADS && data.hasScopeOverlay) ? 'flex' : 'none';
    }

    // 2. Health & Vignette
    const hpBar = document.getElementById('hp-bar-fill');
    const hpText = document.getElementById('hp-text');
    if (hpBar && hpText) {
      const pct = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
      hpBar.style.width = `${pct}%`;
      hpText.textContent = `${Math.ceil(player.health)}`;

      if (player.health < 35) {
        hpBar.style.backgroundColor = '#ff2222';
      } else {
        hpBar.style.backgroundColor = '#00ff88';
      }
    }

    // Stamina Bar
    const stamBar = document.getElementById('stamina-bar-fill');
    if (stamBar) {
      const stamPct = (player.stamina / player.maxStamina) * 100;
      stamBar.style.width = `${stamPct}%`;
    }

    // Red Damage Vignette
    const damageVignette = document.getElementById('damage-vignette');
    if (damageVignette) {
      const lowHpFactor = Math.max(0, (35 - player.health) / 35);
      const intensity = Math.max(player.damageVignette, lowHpFactor * 0.7);
      damageVignette.style.opacity = `${intensity}`;
    }

    // Nuke White Flash Overlay
    const nukeFlash = document.getElementById('nuke-flash');
    if (nukeFlash) {
      nukeFlash.style.opacity = `${gm.nukeFlashIntensity}`;
    }

    // 3. Ammo & Weapon Info
    const ammoCount = document.getElementById('ammo-count');
    const ammoReserve = document.getElementById('ammo-reserve');
    const weaponName = document.getElementById('weapon-name');
    const fireMode = document.getElementById('fire-mode');
    const grenadeCount = document.getElementById('grenade-count');

    if (ammoCount && ammoReserve && weaponName && fireMode && grenadeCount) {
      ammoCount.textContent = `${weapon.currentAmmo}`;
      ammoReserve.textContent = `/ ${weapon.reserveAmmo}`;
      weaponName.textContent = data.name;
      fireMode.textContent = data.fireMode.toUpperCase();
      grenadeCount.textContent = `x${gm.weaponSystem.grenadeCount}`;

      if (weapon.currentAmmo <= Math.floor(data.magSize * 0.25)) {
        ammoCount.classList.add('low-ammo');
      } else {
        ammoCount.classList.remove('low-ammo');
      }
    }

    // 4. Wave & Objective Readout
    const objectiveBanner = document.getElementById('objective-banner');
    if (objectiveBanner) {
      if (gm.gameMode === 'wave') {
        const remaining = gm.enemyManager.enemiesAliveCount + (gm.enemyManager.totalEnemiesInWave - gm.enemyManager.enemiesSpawnedThisWave);
        objectiveBanner.textContent = (gm.gameState === 'wave_cleared') 
          ? `WAVE ${gm.currentWave} COMPLETED! NEXT WAVE INBOUND...`
          : `WAVE ${gm.currentWave} - HOSTILES REMAINING: ${remaining}`;
      } else if (gm.gameMode === 'tdm') {
        objectiveBanner.textContent = `TEAM DEATHMATCH - ALLIES: ${score.matchKills} / ${gm.tdmTargetKills} | AXIS: ${gm.tdmEnemyScore}`;
      } else if (gm.gameMode === 'gungame') {
        objectiveBanner.textContent = `GUN GAME - TIER ${gm.gunGameIndex + 1} / ${gm.gunGameLadder.length} [${data.name}]`;
      }
    }

    // 5. Killstreaks Tray
    this.updateKillstreaksHUD(streaks);

    // 6. Floating Score Popups
    this.updateScorePopups(score.popups);

    // 7. Scrolling Killfeed
    this.updateKillfeed(score.killfeed);

    // 8. Total Score & Match Time
    const totalScore = document.getElementById('total-score-val');
    const matchTimer = document.getElementById('match-timer-val');
    if (totalScore) totalScore.textContent = `${score.score}`;
    if (matchTimer) {
      const mins = Math.floor(gm.matchTime / 60).toString().padStart(2, '0');
      const secs = Math.floor(gm.matchTime % 60).toString().padStart(2, '0');
      matchTimer.textContent = `${mins}:${secs}`;
    }

    // 9. Minimap & Compass rendering
    this.renderMinimap(player, gm.enemyManager.enemies, streaks);
    this.renderCompass(gm.cameraRig.yaw, gm.enemyManager.enemies, player.pos);

    // 10. Respawn screen overlay
    const respawnScreen = document.getElementById('respawn-screen');
    const respawnTimerText = document.getElementById('respawn-timer-text');
    if (respawnScreen && respawnTimerText) {
      if (gm.gameState === 'respawning') {
        respawnScreen.style.display = 'flex';
        respawnTimerText.textContent = `RESPAWNING IN ${Math.ceil(gm.respawnTimer)}...`;
      } else {
        respawnScreen.style.display = 'none';
      }
    }
  }

  updateKillstreaksHUD(streaks) {
    const list = [
      { id: 'uav', elId: 'streak-uav', ready: streaks.availableStreaks.uav },
      { id: 'airstrike', elId: 'streak-airstrike', ready: streaks.availableStreaks.airstrike },
      { id: 'chopper', elId: 'streak-chopper', ready: streaks.availableStreaks.chopper },
      { id: 'nuke', elId: 'streak-nuke', ready: streaks.availableStreaks.nuke }
    ];

    list.forEach(item => {
      const el = document.getElementById(item.elId);
      if (el) {
        if (item.ready) {
          el.classList.add('ready');
        } else {
          el.classList.remove('ready');
        }
      }
    });

    const streakVal = document.getElementById('streak-count-val');
    if (streakVal) streakVal.textContent = `${streaks.currentStreak}`;
  }

  updateScorePopups(popups) {
    const container = document.getElementById('score-popups');
    if (!container) return;

    container.innerHTML = '';
    popups.forEach(p => {
      const el = document.createElement('div');
      el.className = `score-popup ${p.isBonus ? 'bonus' : ''}`;
      el.textContent = p.text;
      container.appendChild(el);
    });
  }

  updateKillfeed(feed) {
    const container = document.getElementById('killfeed-container');
    if (!container) return;

    container.innerHTML = '';
    feed.forEach(item => {
      const row = document.createElement('div');
      row.className = `killfeed-item ${item.isPlayerDead ? 'victim' : 'killer'}`;

      const headshotIcon = item.isHeadshot ? '<span class="kf-headshot"> [HEADSHOT] </span>' : '';
      row.innerHTML = `<span class="kf-killer">${item.killer}</span> [${item.weapon}] ${headshotIcon}<span class="kf-victim">${item.victim}</span>`;
      container.appendChild(row);
    });
  }
}
