export class AudioAnalyzer {
    constructor(audioElement) {
        this.audioElement = audioElement;
        this.audioCtx = null;
        this.source = null;
        this.analyser = null;
        this.filters = [];
        this.isInitialized = false;
        this.initializing = false;
        this.frequencies = [32, 64, 128, 250, 500, 1000, 2000, 4000, 16000];
        window.frequencyAnalyzer = this;

        // Keep the analyzer alive with the actual media element. Previously
        // initialization depended too heavily on which UI action happened
        // first, which is why opening DevTools could appear to "wake" it up.
        if (this.audioElement) {
            const wake = () => {
                this.init();
                this.resume();
            };

            this.audioElement.addEventListener('play', wake);
            this.audioElement.addEventListener('playing', wake);
            this.audioElement.addEventListener('canplay', () => this.init());
            this.audioElement.addEventListener('loadeddata', () => this.init());
        }
    }

    init() {
        if (this.isInitialized) {
            this.resume();
            return true;
        }

        if (this.initializing) return false;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass || !this.audioElement) return false;

        this.initializing = true;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new AudioContextClass();
            }

            if (!this.source) {
                this.source = this.audioCtx.createMediaElementSource(this.audioElement);
            }

            if (!this.analyser) {
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 2048;
                this.analyser.minDecibels = -100;
                this.analyser.maxDecibels = -10;
                this.analyser.smoothingTimeConstant = 0.35;
            }

            if (!this.filters.length) {
                // Real song signal -> analyzer -> EQ filters -> speakers.
                // This keeps the waveform tied to the same audio that is heard.
                this.source.connect(this.analyser);

                let node = this.analyser;
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

                node.connect(this.audioCtx.destination);
            }

            this.isInitialized = true;
            window.frequencyAnalyzer = this;
            this.initializing = false;
            this.resume();
            return true;
        } catch (error) {
            console.error('Frequency analyzer initialization failed:', error);
            this.initializing = false;
            this.isInitialized = false;
            window.frequencyAnalyzer = this;
            return false;
        }
    }

    async resume() {
        if (!this.audioCtx) return false;

        try {
            if (this.audioCtx.state !== 'running') {
                await this.audioCtx.resume();
            }

            // If the browser suspended the context again while the track was
            // loading, make one more attempt while audio is actually playing.
            if (this.audioElement && !this.audioElement.paused && this.audioCtx.state !== 'running') {
                await this.audioCtx.resume();
            }

            return this.audioCtx.state === 'running';
        } catch (error) {
            console.warn('Frequency audio context could not resume:', error);
            return false;
        }
    }

    async start() {
        if (!this.init()) return false;
        return this.resume();
    }

    setBand(index, value) {
        if (this.filters[index]) {
            this.filters[index].gain.value = Number(value);
        }
    }

    reset() {
        this.filters.forEach(filter => {
            filter.gain.value = 0;
        });
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

    getSignalLevel() {
        if (!this.analyser) return 0;
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const sample = (data[i] - 128) / 128;
            sum += sample * sample;
        }
        return Math.sqrt(sum / data.length);
    }
}
