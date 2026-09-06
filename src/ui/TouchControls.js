// TouchControls.js - Dual Virtual Joysticks and Action Buttons for Mobile/Tablet Players
import * as THREE from 'three';

export class TouchControls {
  constructor(player, cameraRig, weaponSystem, gameManager) {
    this.player = player;
    this.cameraRig = cameraRig;
    this.weapons = weaponSystem;
    this.gm = gameManager;

    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.activeTouches = new Map();

    this.joystickCenter = { x: 0, y: 0 };
    this.joystickTouchId = null;
    this.lookTouchId = null;
    this.lastLookPos = { x: 0, y: 0 };

    this.container = document.getElementById('touch-controls-container');
    if (this.isTouchDevice && this.container) {
      this.initTouchUI();
    }
  }

  initTouchUI() {
    this.container.style.display = 'block';

    const leftZone = document.getElementById('touch-stick-zone');
    const stickKnob = document.getElementById('touch-stick-knob');
    const rightZone = document.getElementById('touch-look-zone');

    // Left Movement Joystick
    if (leftZone && stickKnob) {
      leftZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.joystickTouchId = touch.identifier;
        const rect = leftZone.getBoundingClientRect();
        this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.updateJoystick(touch.clientX, touch.clientY, stickKnob);
      }, { passive: false });

      leftZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystickTouchId) {
            this.updateJoystick(touch.clientX, touch.clientY, stickKnob);
          }
        }
      }, { passive: false });

      const resetStick = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystickTouchId) {
            this.joystickTouchId = null;
            stickKnob.style.transform = 'translate(-50%, -50%)';
            this.player.keys.forward = false;
            this.player.keys.backward = false;
            this.player.keys.left = false;
            this.player.keys.right = false;
            this.player.keys.sprint = false;
          }
        }
      };

      leftZone.addEventListener('touchend', resetStick);
      leftZone.addEventListener('touchcancel', resetStick);
    }

    // Right Look Area
    if (rightZone) {
      rightZone.addEventListener('touchstart', (e) => {
        const touch = e.changedTouches[0];
        this.lookTouchId = touch.identifier;
        this.lastLookPos = { x: touch.clientX, y: touch.clientY };
      });

      rightZone.addEventListener('touchmove', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.lookTouchId) {
            const dx = touch.clientX - this.lastLookPos.x;
            const dy = touch.clientY - this.lastLookPos.y;
            this.lastLookPos = { x: touch.clientX, y: touch.clientY };

            const sens = 0.005;
            this.cameraRig.yaw -= dx * sens;
            this.cameraRig.pitch -= dy * sens;
            const maxPitch = (Math.PI / 2) - 0.02;
            this.cameraRig.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.cameraRig.pitch));
          }
        }
      });

      const resetLook = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.lookTouchId) {
            this.lookTouchId = null;
          }
        }
      };

      rightZone.addEventListener('touchend', resetLook);
      rightZone.addEventListener('touchcancel', resetLook);
    }

    // Action Buttons
    this.bindTouchButton('btn-touch-fire', (active) => { this.player.keys.fire = active; });
    this.bindTouchButton('btn-touch-ads', (active) => {
      if (active) this.player.keys.ads = !this.player.keys.ads;
    });
    this.bindTouchButton('btn-touch-jump', (active) => { this.player.keys.jump = active; });
    this.bindTouchButton('btn-touch-crouch', (active) => {
      if (active) this.player.toggleCrouch();
    });
    this.bindTouchButton('btn-touch-reload', (active) => {
      if (active) this.weapons.reload();
    });
    this.bindTouchButton('btn-touch-switch', (active) => {
      if (active) {
        if (this.weapons.switchWeapon()) {
          this.gm.viewmodelRig.setWeapon(this.weapons.getCurrentWeaponData().id);
        }
      }
    });
    this.bindTouchButton('btn-touch-grenade', (active) => {
      if (active) this.gm.handlePlayerThrowGrenade();
    });
  }

  bindTouchButton(elementId, callback) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      callback(true);
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      callback(false);
    }, { passive: false });
  }

  updateJoystick(touchX, touchY, knobEl) {
    const maxRadius = 45;
    let dx = touchX - this.joystickCenter.x;
    let dy = touchY - this.joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const normX = dx / maxRadius;
    const normY = dy / maxRadius;

    this.player.keys.forward = (normY < -0.3);
    this.player.keys.backward = (normY > 0.3);
    this.player.keys.left = (normX < -0.3);
    this.player.keys.right = (normX > 0.3);
    this.player.keys.sprint = (normY < -0.75); // Push far up to sprint
  }
}
