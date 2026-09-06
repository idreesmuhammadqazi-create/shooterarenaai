// MenuManager.js - Main Menu, Gunsmith/Loadout, Map Select, Difficulty, Settings, Pause, and GameOver AAR
import { soundFX } from '../audio/SoundFX.js';
import { RANKS } from '../gameplay/ScoreManager.js';

export class MenuManager {
  constructor(gameManager) {
    this.gm = gameManager;

    // Loadout selections
    this.selectedMode = 'wave';
    this.selectedMap = 'blockment';
    this.selectedDifficulty = 'regular';
    this.selectedPrimary = 'm4';
    this.selectedCamo = 'standard';
    this.selectedPerk1 = 'sleightOfHand';
    this.selectedPerk2 = 'stoppingPower';

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.mainMenu = document.getElementById('main-menu');
    this.pauseMenu = document.getElementById('pause-menu');
    this.gameOverMenu = document.getElementById('game-over-menu');
    this.loadoutModal = document.getElementById('loadout-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.careerModal = document.getElementById('career-modal');
    this.hudContainer = document.getElementById('hud-container');
  }

  bindEvents() {
    // Main Menu Buttons
    document.getElementById('btn-play')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.startGame();
    });

    document.getElementById('btn-loadout')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.showModal('loadout');
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.showModal('settings');
    });

    document.getElementById('btn-career')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.updateCareerUI();
      this.showModal('career');
    });

    // Close modal buttons
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFX.playUIClick();
        this.closeModals();
      });
    });

    // Game Mode Buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        soundFX.playUIClick();
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMode = btn.dataset.mode;
      });
    });

    // Map Buttons
    document.querySelectorAll('.map-card').forEach(card => {
      card.addEventListener('click', (e) => {
        soundFX.playUIClick();
        document.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedMap = card.dataset.map;
      });
    });

    // Difficulty Buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFX.playUIClick();
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = btn.dataset.diff;
      });
    });

    // Weapon Selection in Loadout
    document.querySelectorAll('.weapon-select-card').forEach(card => {
      card.addEventListener('click', () => {
        soundFX.playUIClick();
        document.querySelectorAll('.weapon-select-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedPrimary = card.dataset.weapon;
      });
    });

    // Camo Selection
    document.querySelectorAll('.camo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFX.playUIClick();
        const camo = btn.dataset.camo;
        if (this.gm.scoreManager.career.unlockedCamos.includes(camo)) {
          document.querySelectorAll('.camo-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectedCamo = camo;
        } else {
          soundFX.playReloadPart('empty');
        }
      });
    });

    // Perks Selection
    document.querySelectorAll('.perk-btn-p1').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFX.playUIClick();
        document.querySelectorAll('.perk-btn-p1').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedPerk1 = btn.dataset.perk;
      });
    });

    document.querySelectorAll('.perk-btn-p2').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFX.playUIClick();
        document.querySelectorAll('.perk-btn-p2').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedPerk2 = btn.dataset.perk;
      });
    });

    // Settings Sliders & Inputs
    const sensSlider = document.getElementById('setting-sens');
    if (sensSlider) {
      sensSlider.addEventListener('input', (e) => {
        this.gm.cameraRig.mouseSensitivity = parseFloat(e.target.value);
        document.getElementById('setting-sens-val').textContent = e.target.value;
      });
    }

    const fovSlider = document.getElementById('setting-fov');
    if (fovSlider) {
      fovSlider.addEventListener('input', (e) => {
        const fov = parseInt(e.target.value);
        this.gm.cameraRig.baseFOV = fov;
        this.gm.cameraRig.currentFOV = fov;
        document.getElementById('setting-fov-val').textContent = fov;
      });
    }

    const sfxSlider = document.getElementById('setting-sfx');
    if (sfxSlider) {
      sfxSlider.addEventListener('input', (e) => {
        soundFX.setSfxVolume(parseFloat(e.target.value));
        document.getElementById('setting-sfx-val').textContent = `${Math.round(e.target.value * 100)}%`;
      });
    }

    const musicSlider = document.getElementById('setting-music');
    if (musicSlider) {
      musicSlider.addEventListener('input', (e) => {
        soundFX.setMusicVolume(parseFloat(e.target.value));
        document.getElementById('setting-music-val').textContent = `${Math.round(e.target.value * 100)}%`;
      });
    }

    const invertYCheckbox = document.getElementById('setting-inverty');
    if (invertYCheckbox) {
      invertYCheckbox.addEventListener('change', (e) => {
        this.gm.cameraRig.invertY = e.target.checked;
      });
    }

    // Pause Menu Buttons
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.resumeGame();
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.pauseMenu.style.display = 'none';
      this.gm.restartCurrentMatch();
    });

    document.getElementById('btn-quit')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.returnToMainMenu();
    });

    // Game Over Menu Buttons
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.gameOverMenu.style.display = 'none';
      this.gm.restartCurrentMatch();
    });

    document.getElementById('btn-aar-menu')?.addEventListener('click', () => {
      soundFX.playUIClick();
      this.returnToMainMenu();
    });

    // Escape Key for Pause Menu
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.gm.gameState === 'playing' || this.gm.gameState === 'wave_cleared') {
          this.pauseGame();
        } else if (this.gm.gameState === 'paused') {
          this.resumeGame();
        }
      }
    });

    // Sound effects on button hover
    document.querySelectorAll('button, .map-card, .weapon-select-card').forEach(el => {
      el.addEventListener('mouseenter', () => soundFX.playUIHover());
    });
  }

  showModal(name) {
    this.closeModals();
    if (name === 'loadout') this.loadoutModal.style.display = 'flex';
    if (name === 'settings') this.settingsModal.style.display = 'flex';
    if (name === 'career') this.careerModal.style.display = 'flex';
  }

  closeModals() {
    if (this.loadoutModal) this.loadoutModal.style.display = 'none';
    if (this.settingsModal) this.settingsModal.style.display = 'none';
    if (this.careerModal) this.careerModal.style.display = 'none';
  }

  startGame() {
    this.mainMenu.style.display = 'none';
    this.pauseMenu.style.display = 'none';
    this.gameOverMenu.style.display = 'none';
    this.hudContainer.style.display = 'block';

    const perks = {
      sleightOfHand: (this.selectedPerk1 === 'sleightOfHand'),
      scavenger: (this.selectedPerk1 === 'scavenger'),
      stoppingPower: (this.selectedPerk2 === 'stoppingPower'),
      lightweight: (this.selectedPerk2 === 'lightweight')
    };

    soundFX.stopMusic();
    this.gm.startMatch(
      this.selectedMode,
      this.selectedMap,
      this.selectedDifficulty,
      this.selectedPrimary,
      this.selectedCamo,
      perks
    );

    // Request pointer lock
    this.gm.cameraRig.domElement.requestPointerLock();
  }

  pauseGame() {
    this.gm.gameState = 'paused';
    this.pauseMenu.style.display = 'flex';
    document.exitPointerLock?.();
  }

  resumeGame() {
    this.gm.gameState = 'playing';
    this.pauseMenu.style.display = 'none';
    this.gm.cameraRig.domElement.requestPointerLock();
  }

  returnToMainMenu() {
    this.pauseMenu.style.display = 'none';
    this.gameOverMenu.style.display = 'none';
    this.hudContainer.style.display = 'none';
    this.mainMenu.style.display = 'flex';
    this.gm.gameState = 'menu';

    document.exitPointerLock?.();
    soundFX.startMenuMusic();
  }

  showGameOverAAR() {
    this.gameOverMenu.style.display = 'flex';
    this.hudContainer.style.display = 'none';
    document.exitPointerLock?.();

    const score = this.gm.scoreManager;
    const rank = score.getCurrentRank();
    const nextRank = score.getNextRank();

    document.getElementById('aar-score').textContent = `${score.score}`;
    document.getElementById('aar-kills').textContent = `${score.matchKills}`;
    document.getElementById('aar-headshots').textContent = `${score.matchHeadshots}`;
    document.getElementById('aar-streak').textContent = `${score.highestStreak}`;
    document.getElementById('aar-wave').textContent = `${this.gm.currentWave}`;

    // Rank & XP Bar
    document.getElementById('aar-rank-name').textContent = rank.name;
    document.getElementById('aar-level').textContent = `LVL ${rank.level}`;

    if (nextRank) {
      const xpNeeded = nextRank.xpRequired - rank.xpRequired;
      const currentProgress = score.career.xp - rank.xpRequired;
      const pct = Math.min(100, Math.max(0, (currentProgress / xpNeeded) * 100));
      document.getElementById('aar-xp-bar-fill').style.width = `${pct}%`;
      document.getElementById('aar-xp-text').textContent = `${score.career.xp} / ${nextRank.xpRequired} XP`;
    } else {
      document.getElementById('aar-xp-bar-fill').style.width = '100%';
      document.getElementById('aar-xp-text').textContent = 'MAX RANK ACHIEVED';
    }
  }

  updateCareerUI() {
    const score = this.gm.scoreManager;
    const career = score.career;
    const rank = score.getCurrentRank();

    document.getElementById('career-rank').textContent = `${rank.name} (LVL ${rank.level})`;
    document.getElementById('career-total-kills').textContent = `${career.totalKills}`;
    document.getElementById('career-total-deaths').textContent = `${career.totalDeaths}`;
    const kd = career.totalDeaths > 0 ? (career.totalKills / career.totalDeaths).toFixed(2) : career.totalKills;
    document.getElementById('career-kd').textContent = `${kd}`;
    document.getElementById('career-headshots').textContent = `${career.totalHeadshots}`;
    document.getElementById('career-best-streak').textContent = `${career.bestStreak}`;
    document.getElementById('career-best-wave').textContent = `${career.highestWave}`;
    document.getElementById('career-best-score').textContent = `${career.bestScore}`;

    // Update Camo buttons unlocked status
    document.querySelectorAll('.camo-btn').forEach(btn => {
      const camo = btn.dataset.camo;
      if (career.unlockedCamos.includes(camo)) {
        btn.classList.remove('locked');
        btn.removeAttribute('disabled');
      } else {
        btn.classList.add('locked');
      }
    });
  }

  update(dt) {
    if (this.gm.gameState === 'game_over' && this.gameOverMenu.style.display !== 'flex') {
      this.showGameOverAAR();
    }
  }
}
