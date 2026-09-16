export class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        
        this.onTimeUpdate = null;
        this.onEnded = null;
        this.onPlayStateChange = null;

        this.audio.addEventListener('timeupdate', () => {
            this.currentTime = this.audio.currentTime;
            if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.duration);
        });

        this.audio.addEventListener('loadedmetadata', () => {
            this.duration = this.audio.duration;
        });

        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            if (this.onEnded) this.onEnded();
        });
    }

    load(track) {
        if (track && track.audioUrl) {
            this.audio.src = track.audioUrl;
            this.audio.load();
        }
    }

    play() {
        this.audio.play().then(() => {
            this.isPlaying = true;
            if (this.onPlayStateChange) this.onPlayStateChange(true);
        }).catch(err => console.log("Playback prevented:", err));
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        if (this.onPlayStateChange) this.onPlayStateChange(false);
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    seek(timeInSeconds) {
        if (!isNaN(this.audio.duration)) {
            this.audio.currentTime = timeInSeconds;
        }
    }

    setVolume(value) {
        this.audio.volume = Math.max(0, Math.min(1, value));
    }
}
