// ScoreManager.js - COD XP progression, medals, floating score events, and LocalStorage career stats
import { soundFX } from '../audio/SoundFX.js';

export const RANKS = [
  { level: 1, name: 'Private I', xpRequired: 0 },
  { level: 2, name: 'Private II', xpRequired: 500 },
  { level: 3, name: 'Corporal I', xpRequired: 1200 },
  { level: 4, name: 'Corporal II', xpRequired: 2200 },
  { level: 5, name: 'Sergeant I', xpRequired: 3500, unlock: 'camo_desert' },
  { level: 6, name: 'Sergeant II', xpRequired: 5200 },
  { level: 7, name: 'Master Sergeant', xpRequired: 7400 },
  { level: 8, name: 'Lieutenant', xpRequired: 10000, unlock: 'camo_arctic' },
  { level: 9, name: 'Captain', xpRequired: 13500 },
  { level: 10, name: 'Major', xpRequired: 18000, unlock: 'camo_digital' },
  { level: 11, name: 'Colonel', xpRequired: 24000 },
  { level: 12, name: 'General', xpRequired: 32000 },
  { level: 13, name: 'Commander', xpRequired: 42000 },
  { level: 14, name: 'Prestige Master', xpRequired: 55000, unlock: 'camo_gold' }
];

export class ScoreManager {
  constructor() {
    this.score = 0;
    this.matchKills = 0;
    this.matchDeaths = 0;
    this.matchHeadshots = 0;
    this.highestStreak = 0;

    // Multi-kill timer
    this.lastKillTime = 0;
    this.multiKillCount = 0;

    // Floating score popups
    this.popups = [];
    this.killfeed = [];

    // Load persistent stats
    this.loadCareerStats();
  }

  loadCareerStats() {
    try {
      const saved = localStorage.getItem('blockops_career_stats');
      if (saved) {
        this.career = JSON.parse(saved);
      } else {
        this.career = {
          xp: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalHeadshots: 0,
          highestWave: 1,
          bestStreak: 0,
          bestScore: 0,
          unlockedCamos: ['standard']
        };
      }
    } catch (e) {
      this.career = {
        xp: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalHeadshots: 0,
        highestWave: 1,
        bestStreak: 0,
        bestScore: 0,
        unlockedCamos: ['standard']
      };
    }
  }

  saveCareerStats() {
    try {
      localStorage.setItem('blockops_career_stats', JSON.stringify(this.career));
    } catch (e) {}
  }

  resetMatch() {
    this.score = 0;
    this.matchKills = 0;
    this.matchDeaths = 0;
    this.matchHeadshots = 0;
    this.highestStreak = 0;
    this.multiKillCount = 0;
    this.popups = [];
    this.killfeed = [];
  }

  getCurrentRank() {
    let current = RANKS[0];
    for (const r of RANKS) {
      if (this.career.xp >= r.xpRequired) {
        current = r;
      } else {
        break;
      }
    }
    return current;
  }

  getNextRank() {
    const current = this.getCurrentRank();
    const idx = RANKS.findIndex(r => r.level === current.level);
    return (idx < RANKS.length - 1) ? RANKS[idx + 1] : null;
  }

  // Add Score Event
  addScore(points, text, isBonus = false) {
    this.score += points;
    this.career.xp += points;

    this.popups.push({
      text: `+${points} ${text.toUpperCase()}`,
      life: 2.0,
      isBonus
    });

    soundFX.playScorePopup();
    this.checkUnlocks();
  }

  checkUnlocks() {
    const currentRank = this.getCurrentRank();
    if (currentRank.unlock && !this.career.unlockedCamos.includes(currentRank.unlock.replace('camo_', ''))) {
      const camoName = currentRank.unlock.replace('camo_', '');
      this.career.unlockedCamos.push(camoName);
      this.addScore(500, `UNLOCKED ${camoName.toUpperCase()} CAMO!`, true);
      this.saveCareerStats();
    }
  }

  // Register an Enemy Kill
  recordKill(weaponName = 'M4-VOX', isHeadshot = false, distance = 10, currentStreak = 1) {
    this.matchKills++;
    this.career.totalKills++;

    if (currentStreak > this.highestStreak) {
      this.highestStreak = currentStreak;
    }
    if (currentStreak > this.career.bestStreak) {
      this.career.bestStreak = currentStreak;
    }

    // Base Kill Score
    this.addScore(100, 'ENEMY ELIMINATED');

    // Headshot bonus
    if (isHeadshot) {
      this.matchHeadshots++;
      this.career.totalHeadshots++;
      this.addScore(50, 'HEADSHOT BONUS', true);
    }

    // Longshot bonus
    if (distance > 30) {
      this.addScore(50, 'LONGSHOT BONUS', true);
    } else if (distance < 4) {
      this.addScore(25, 'POINT BLANK', true);
    }

    // Multi-Kill Tracking
    const now = performance.now() / 1000;
    if (now - this.lastKillTime < 3.0) {
      this.multiKillCount++;
      if (this.multiKillCount === 2) this.addScore(100, 'DOUBLE KILL!', true);
      else if (this.multiKillCount === 3) this.addScore(150, 'TRIPLE KILL!', true);
      else if (this.multiKillCount >= 4) this.addScore(250, 'MULTI KILL!', true);
    } else {
      this.multiKillCount = 1;
    }
    this.lastKillTime = now;

    // Add to Killfeed
    this.addKillfeedEntry('YOU', weaponName, 'ENEMY SOLDIER', isHeadshot);
    this.saveCareerStats();
  }

  recordDeath(killer = 'ENEMY RIFLEMAN') {
    this.matchDeaths++;
    this.career.totalDeaths++;
    this.addKillfeedEntry(killer, 'ELIMINATED', 'YOU', false, true);
    this.saveCareerStats();
  }

  addKillfeedEntry(killer, weapon, victim, isHeadshot = false, isPlayerDead = false) {
    this.killfeed.unshift({
      killer,
      weapon,
      victim,
      isHeadshot,
      isPlayerDead,
      life: 4.5
    });

    if (this.killfeed.length > 6) {
      this.killfeed.pop();
    }
  }

  recordWaveClear(waveNum) {
    const waveBonus = waveNum * 250;
    this.addScore(waveBonus, `WAVE ${waveNum} CLEARED!`, true);

    if (waveNum > this.career.highestWave) {
      this.career.highestWave = waveNum;
    }
    if (this.score > this.career.bestScore) {
      this.career.bestScore = this.score;
    }
    this.saveCareerStats();
  }

  update(dt) {
    // Decay popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].life -= dt;
      if (this.popups[i].life <= 0) {
        this.popups.splice(i, 1);
      }
    }

    // Decay killfeed
    for (let i = this.killfeed.length - 1; i >= 0; i--) {
      this.killfeed[i].life -= dt;
      if (this.killfeed[i].life <= 0) {
        this.killfeed.splice(i, 1);
      }
    }
  }
}
