/**
 * IMPROVED GOAL NOTIFICATION SYSTEM
 *
 * Replaces the central "GOOOOL" overlay with individual goal animations
 * within each match scoreboard, along with sound effects and a mute button.
 */

(function() {
  // Audio context and oscillator management
  let audioContext = null;
  let audioMuted = false;

  /**
   * Initialize audio context (must be called after user interaction)
   */
  function initAudioContext() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * Play goal sound using Web Audio API
   * Creates a "goal horn" effect with multiple harmonics
   */
  function playGoalSound() {
    if (audioMuted || !audioContext) return;

    try {
      initAudioContext();

      const now = audioContext.currentTime;
      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      masterGain.gain.setValueAtTime(0.25, now);

      // First note: Deep horn
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.type = 'sine';
      osc1.connect(gain1);
      gain1.connect(masterGain);

      osc1.frequency.setValueAtTime(150, now);
      osc1.frequency.exponentialRampToValueAtTime(300, now + 0.2);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.3, now + 0.2);

      // Second note: Mid horn
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.type = 'sine';
      osc2.connect(gain2);
      gain2.connect(masterGain);

      osc2.frequency.setValueAtTime(300, now + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(600, now + 0.25);
      gain2.gain.setValueAtTime(0.3, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.2, now + 0.25);

      // Third note: High horn
      const osc3 = audioContext.createOscillator();
      const gain3 = audioContext.createGain();
      osc3.type = 'sawtooth';
      osc3.connect(gain3);
      gain3.connect(masterGain);

      osc3.frequency.setValueAtTime(600, now + 0.1);
      osc3.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
      gain3.gain.setValueAtTime(0.2, now + 0.1);
      gain3.gain.exponentialRampToValueAtTime(0.1, now + 0.3);

      // Master envelope
      masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc1.start(now);
      osc1.stop(now + 0.3);

      osc2.start(now + 0.05);
      osc2.stop(now + 0.3);

      osc3.start(now + 0.1);
      osc3.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  /**
   * Show goal animation within the match scoreboard
   *
   * @param {string} matchId - Match identifier (e.g., "j1m1")
   * @param {string} team - Team that scored ("a" or "b")
   */
  function showGoalNotification(matchId, team) {
    // Get the score element for this match
    const scoreEl = document.querySelector(`#mlw-${matchId} .ml-score`);
    if (!scoreEl) return;

    // Create goal flash element if it doesn't exist
    let goalFlash = scoreEl.querySelector('.goal-flash-anim');
    if (!goalFlash) {
      goalFlash = document.createElement('div');
      goalFlash.className = 'goal-flash-anim';
      goalFlash.innerHTML = '<span class="goal-text">¡GOL!</span>';
      scoreEl.appendChild(goalFlash);
    }

    // Reset animation by removing and re-adding class
    goalFlash.classList.remove('active');
    void goalFlash.offsetWidth; // Trigger reflow to restart animation
    goalFlash.classList.add('active');

    // Remove animation class after 3 seconds
    setTimeout(() => {
      goalFlash.classList.remove('active');
    }, 3000);

    // Play sound effect
    playGoalSound();
  }

  /**
   * Toggle audio mute state
   */
  function toggleAudioMute() {
    audioMuted = !audioMuted;
    const btn = document.getElementById('audio-mute-btn');
    if (btn) {
      btn.setAttribute('data-muted', audioMuted);
      btn.textContent = audioMuted ? '🔇' : '🔊';
      btn.title = audioMuted ? 'Sonido desactivado' : 'Sonido activado';
    }
    return audioMuted;
  }

  /**
   * Get current mute state
   */
  function isAudioMuted() {
    return audioMuted;
  }

  /**
   * Initialize mute button in the UI
   */
  function initMuteButton() {
    // Check if button already exists
    if (document.getElementById('audio-mute-btn')) return;

    // Create mute button
    const btn = document.createElement('button');
    btn.id = 'audio-mute-btn';
    btn.className = 'audio-mute-button';
    btn.textContent = '🔊';
    btn.title = 'Sonido activado';
    btn.setAttribute('data-muted', 'false');
    btn.setAttribute('aria-label', 'Toggle match sound');
    btn.onclick = function(e) {
      e.stopPropagation();
      toggleAudioMute();
    };

    // Insert button in a strategic location
    // Try to place it near the match controls
    const container = document.body;
    if (container) {
      container.appendChild(btn);
    }
  }

  // Expose functions globally
  window.goalNotificationImproved = {
    show: showGoalNotification,
    playSound: playGoalSound,
    toggleMute: toggleAudioMute,
    isMuted: isAudioMuted,
    initMute: initMuteButton,
    initAudio: initAudioContext
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMuteButton);
  } else {
    initMuteButton();
  }

  // Allow audio context to be initialized on first user interaction
  document.addEventListener('click', initAudioContext, { once: true });
  document.addEventListener('touchstart', initAudioContext, { once: true });
})();
