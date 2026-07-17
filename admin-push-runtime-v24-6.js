(() => {
  let audioContext = null;

  function unlockSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioContext = audioContext || new AudioCtx();
      if (audioContext.state === 'suspended') audioContext.resume();
      localStorage.setItem('bdj_push_sound_enabled', '1');
    } catch (_) {}
  }

  function playChime() {
    if (localStorage.getItem('bdj_push_sound_enabled') !== '1') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioContext = audioContext || new AudioCtx();
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      const now = audioContext.currentTime;
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      gain.connect(audioContext.destination);

      [880, 1174].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + index * 0.13);
        oscillator.connect(gain);
        oscillator.start(now + index * 0.13);
        oscillator.stop(now + 0.55);
      });
    } catch (_) {}
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
    window.addEventListener(eventName, unlockSound, { once: true, passive: true });
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type !== 'BDJ_PUSH_RECEIVED') return;
      playChime();
    });
  }

  window.BDJPushSound = {
    unlock: unlockSound,
    play: playChime,
    isEnabled: () => localStorage.getItem('bdj_push_sound_enabled') === '1'
  };
})();
