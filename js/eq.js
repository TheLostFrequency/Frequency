export class AudioAnalyzer {
    constructor(audioElement) {
        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.isInitialized = false;
        this.audioElement = audioElement;
    }

    init() {
        if (this.isInitialized) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;

        try {
            this.source = this.audioCtx.createMediaElementSource(this.audioElement);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
            this.isInitialized = true;
        } catch (e) {
            console.log("Audio analyzer connection note:", e);
        }
    }

    getWaveformata() {
        if (!this.isInitialized || !this.analyser) {
            return new Uint8Array(0);
        }
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(dataArray);
        return dataArray;
    }
}
