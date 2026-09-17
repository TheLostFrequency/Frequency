export class AudioAnalyzer {
    constructor(audioElement) {
        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.filters = [];
        this.isInitialized = false;
        this.audioElement = audioElement;
        this.frequencies = [32, 64, 128, 250, 500, 1000, 2000, 4000, 16000];
        this.initPromise = null;

        if (this.audioElement) {
            this.audioElement.addEventListener('play', () => {
                this.init();
                this.resume();
            });
        }

        window.frequencyAnalyzer = this;
    }

    init() {
        if (this.isInitialized) {
            this.resume();
            return true;
        }
        if (this.initPromise) return this.initPromise;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext || !this.audioElement) return false;

        try {
            if (!this.audioCtx) this.audioCtx = new AudioContext();
            if (!this.analyser) {
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 1024;
                this.analyser.minDecibels = -100;
                this.analyser.maxDecibels = -12;
                this.analyser.smoothingTimeConstant = 0.72;
            }

            if (!this.source) {
                this.source = this.audioCtx.createMediaElementSource(this.audioElement);

                let node = this.source;
                this.filters = this.frequencies.map((frequency, index) => {
                    const filter = this.audioCtx.createBiquadFilter();
                    filter.type = index === 0
                        ? 'lowshelf'
                        : index === this.frequencies.length - 1
                            ? 'highshelf'
                            : 'peaking';
                    filter.frequency.value = frequency;
                    filter.Q.value = index === 0 || index === this.frequencies.length - 1 ? 0.7 : 1;
                    filter.gain.value = 0;
                    node.connect(filter);
                    node = filter;
                    return filter;
                });

                node.connect(this.analyser);
                this.analyser.connect(this.audioCtx.destination);
            }

            this.isInitialized = true;
            window.frequencyAnalyzer = this;
            this.resume();
            return true;
        } catch (error) {
            console.warn('Frequency EQ analyzer could not connect:', error);
            this.isInitialized = false;
            window.frequencyAnalyzer = this;
            return false;
        }
    }

    resume() {
        if (this.audioCtx?.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
    }

    setBand(index, value) {
        if (this.filters[index]) this.filters[index].gain.value = Number(value);
    }

    reset() {
        this.filters.forEach(filter => { filter.gain.value = 0; });
    }

    getWaveformData() {
        if (!this.analyser) return new Uint8Array(0);
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }

    getFrequencyData() {
        if (!this.analyser) return new Uint8Array(0);
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }
}
