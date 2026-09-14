/**
 * FREQUENCY AUDIO ENGINE
 * Handles playback, Web Audio API context initialization, filter routing, volume, and player state.
 */
class AudioEngine {
    constructor() {
        this.audio = document.getElementById('audioElement');
        this.playPauseBtn = document.getElementById('btnPlay') || document.getElementById('btnPlayPause');
        this.seekSlider = document.getElementById('seekSlider');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationTimeEl = document.getElementById('durationTime');

        this.currentSong = null;

        // Web Audio API Pipeline Properties
        this.audioCtx = null;
        this.sourceNode = null;
        this.isAudioContextSetup = false;

        this.initListeners();
    }

    /**
     * Initializes Web Audio Context on first user interaction
     * and connects audio element to global equalizer node chain.
     */
    initWebAudio() {
        if (this.isAudioContextSetup) return;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();
            this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);

            // Hook source node into Equalizer if available
            if (window.frequencyEQ && typeof window.frequencyEQ.init === 'function') {
                window.frequencyEQ.init(this.audioCtx, this.sourceNode);
            } else {
                this.sourceNode.connect(this.audioCtx.destination);
            }

            this.isAudioContextSetup = true;
        } catch (err) {
            console.warn('Web Audio Context initialization warning:', err);
        }
    }

    loadSong(song) {
        if (!song) return;
        this.currentSong = song;
        this.audio.src = song.audio_url;
        
        // Update Player UI
        const titleEl = document.getElementById('playerTitle');
        const artistEl = document.getElementById('playerArtist');
        const coverEl = document.getElementById('playerCover');

        if (titleEl) titleEl.textContent = song.title;
        if (artistEl) artistEl.textContent = song.artist;
        if (coverEl && song.cover_url) {
            coverEl.style.backgroundImage = `url('${song.cover_url}')`;
        }

        this.play();
    }

    play() {
        if (!this.audio.src) return;

        // Setup Web Audio Context on first playback
        this.initWebAudio();

        // Resume Audio Context if suspended by browser autoplay policy
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.audio.play().catch((e) => console.log("Playback interrupted:", e));
        if (this.playPauseBtn) this.playPauseBtn.textContent = '⏸';
    }

    pause() {
        this.audio.pause();
        if (this.playPauseBtn) this.playPauseBtn.textContent = '▶';
    }

    togglePlay() {
        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    initListeners() {
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        }

        this.audio.addEventListener('timeupdate', () => {
            if (this.audio.duration && this.seekSlider) {
                const pct = (this.audio.currentTime / this.audio.duration) * 100;
                this.seekSlider.value = pct;
                if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
                if (this.durationTimeEl) this.durationTimeEl.textContent = this.formatTime(this.audio.duration);
            }
        });

        if (this.seekSlider) {
            this.seekSlider.addEventListener('input', () => {
                if (this.audio.duration) {
                    this.audio.currentTime = (this.seekSlider.value / 100) * this.audio.duration;
                }
            });
        }

        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', () => {
                this.audio.volume = this.volumeSlider.value / 100;
            });
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
}

// Instantiate engine globally
window.audioEngine = new AudioEngine();
