/**
 * FREQUENCY AUDIO ENGINE
 * Audio persistence, playback state, seeking, and queue management.
 */
class AudioEngine {
    constructor() {
        this.audio = document.getElementById('audioElement');
        this.playPauseBtn = document.getElementById('btnPlayPause');
        this.seekSlider = document.getElementById('seekSlider');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationTimeEl = document.getElementById('durationTime');

        this.currentSong = null;
        this.initListeners();
    }

    loadSong(song) {
        this.currentSong = song;
        this.audio.src = song.audio_url;
        
        // Update Player UI
        document.getElementById('playerTitle').textContent = song.title;
        document.getElementById('playerArtist').textContent = song.artist;
        if (song.cover_url) {
            document.getElementById('playerCover').style.backgroundImage = `url('${song.cover_url}')`;
        }

        this.play();
    }

    play() {
        if (!this.audio.src) return;
        this.audio.play().catch(() => {});
        this.playPauseBtn.textContent = '⏸';
    }

    pause() {
        this.audio.pause();
        this.playPauseBtn.textContent = '▶';
    }

    togglePlay() {
        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    initListeners() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());

        this.audio.addEventListener('timeupdate', () => {
            if (this.audio.duration) {
                const pct = (this.audio.currentTime / this.audio.duration) * 100;
                this.seekSlider.value = pct;
                this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
                this.durationTimeEl.textContent = this.formatTime(this.audio.duration);
            }
        });

        this.seekSlider.addEventListener('input', () => {
            if (this.audio.duration) {
                this.audio.currentTime = (this.seekSlider.value / 100) * this.audio.duration;
            }
        });

        this.volumeSlider.addEventListener('input', () => {
            this.audio.volume = this.volumeSlider.value / 100;
        });
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
}
