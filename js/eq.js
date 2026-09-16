export class AudioAnalyzer {
    constructor(audioElement) {
        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.isInitialized = false;
        this.audioElement = audioElement;
    }
    init() {
        if (this.isInitialized) return true;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.audioCtx = new AudioContext();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.72;
        try {
            this.source = this.audioCtx.createMediaElementSource(this.audioElement);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.warn('Audio analyzer connection note:', error);
            return false;
        }
    }
    resume() { if (this.audioCtx?.state === 'suspended') this.audioCtx.resume(); }
    getWaveformData() {
        if (!this.isInitialized || !this.analyser) return new Uint8Array(0);
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }
    getFrequencyData() {
        if (!this.isInitialized || !this.analyser) return new Uint8Array(0);
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }
}
