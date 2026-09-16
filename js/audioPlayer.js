export class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.audio.preload = 'metadata';
        this.audio.crossOrigin = 'anonymous';
        this.audio.volume = 1;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.onTimeUpdate = null;
        this.onEnded = null;
        this.onPlayStateChange = null;
        this.audio.addEventListener('timeupdate', () => {
            this.currentTime = this.audio.currentTime || 0;
            if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.duration);
        });
        this.audio.addEventListener('loadedmetadata', () => {
            this.duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
            if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.duration);
        });
        this.audio.addEventListener('durationchange', () => {
            this.duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
        });
        this.audio.addEventListener('play', () => this.setPlaying(true));
        this.audio.addEventListener('pause', () => this.setPlaying(false));
        this.audio.addEventListener('ended', () => {
            this.setPlaying(false);
            if (this.onEnded) this.onEnded();
        });
        this.audio.addEventListener('error', () => {
            console.warn('Audio element error:', this.audio.error);
        });
    }
    setPlaying(value) {
        this.isPlaying = value;
        if (this.onPlayStateChange) this.onPlayStateChange(value);
    }
    load(track) {
        if (!track?.audioUrl) return;
        this.pause();
        this.audio.src = track.audioUrl;
        this.audio.load();
        this.currentTime = 0;
        this.duration = 0;
    }
    async play() {
        try {
            await this.audio.play();
        } catch (error) {
            console.warn('Playback prevented:', error);
        }
    }
    pause() { this.audio.pause(); }
    togglePlay() { return this.isPlaying ? this.pause() : this.play(); }
    seek(timeInSeconds) {
        if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(timeInSeconds, this.audio.duration));
    }
    setVolume(value) { this.audio.volume = Math.max(0, Math.min(1, value)); }
}
