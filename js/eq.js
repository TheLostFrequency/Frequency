/**
 * FREQUENCY — 10-Band Glassmorphic Equalizer Engine
 * Web Audio API Parametric Routing & Real-Time Spectrum Visualizer
 */

class EqualizerEngine {
    constructor() {
        this.audioCtx = null;
        this.sourceNode = null;
        this.masterGainNode = null;
        this.analyser = null;
        this.canvas = null;
        this.canvasCtx = null;
        this.animationFrameId = null;

        // 10 Frequency Bands (Hz) matching hardware UI
        this.frequencies = [32, 64, 128, 250, 500, 1000, 2000, 4000, 8000, 16000];
        this.filters = [];

        // Acoustic Preset Gain Curves (dB values corresponding to frequencies array)
        this.presets = {
            'flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            'bass-booster': [6, 5, 4, 2.5, 1, 0, 0, 0, 0, 0],
            'bass-reducer': [-6, -5, -4, -2.5, -1, 0, 0, 0, 0, 0],
            'rock': [4.5, 3.5, 2, 0, -1, 0.5, 2.5, 3.5, 4, 4.5],
            'hard': [5, 4, 2, 0, -1, 0, 2, 3.5, 4.5, 5],
            'hip-hop': [5.5, 4.5, 3, 1, -1, -0.5, 1, 2, 3.5, 4],
            'dance': [5, 4.5, 2, 0, 0, -1.5, -2, 0, 3, 4],
            'pop': [-1.5, 1, 2.5, 3.5, 4, 3, 1.5, 0.5, -1, -1.5],
            'vocal': [-3, -2, 0, 2.5, 4.5, 4.5, 3.5, 1.5, 0, -2],
            'acoustic': [3, 2.5, 1.5, 0, 1, 1.5, 2.5, 3, 2.5, 2],
            'loudness': [4, 3, 1, 0, -1, 0, -0.5, -3, 3.5, 1],
            'piano': [3, 2, 0, 1.5, 2, 1.5, 2.5, 3, 2, 1.5],
            'rnb': [4, 3.5, 1.5, -1, -2, 0, 1.5, 2, 2.5, 3],
            'soul': [3, 2, 0, 1, 2, 2.5, 1.5, 0, -1, -2],
            'spoken': [-5, -3, -1, 1, 3, 3.5, 3, 1, -2, -4]
        };

        this.initDOM();
    }

    /**
     * Bind UI elements and event listeners
     */
    initDOM() {
        this.canvas = document.getElementById('eq-canvas');
        if (this.canvas) {
            this.canvasCtx = this.canvas.getContext('2d');
        }

        // Attach listeners to 10-band sliders
        this.frequencies.forEach(freq => {
            const slider = document.getElementById(`eq-${freq}`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.setBandGain(freq, value);
                    this.updateValueDisplay(freq, value);
                    this.clearActivePresetHighlight();
                });
            }
        });

        // Master Volume slider listener
        const masterVolSlider = document.getElementById('master-vol');
        if (masterVolSlider) {
            masterVolSlider.addEventListener('input', (e) => {
                if (this.masterGainNode) {
                    this.masterGainNode.gain.setValueAtTime(e.target.value / 100, this.audioCtx ? this.audioCtx.currentTime + 0.01 : 0);
                }
            });
        }

        // Attach listeners to preset buttons
        const presetBtns = document.querySelectorAll('.preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const presetKey = e.target.getAttribute('data-preset');
                this.applyPreset(presetKey);

                presetBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    /**
     * Initialize Web Audio API nodes with HTML5 Audio Element
     */
    initAudioContext(audioElement) {
        if (this.audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        this.masterGainNode = this.audioCtx.createGain();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 128;

        try {
            this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);
        } catch (err) {
            console.warn("MediaElementSource warning:", err);
            return;
        }

        let previousNode = this.sourceNode;
        this.filters = [];

        // Build BiquadFilter Cascade
        this.frequencies.forEach((freq, index) => {
            const filter = this.audioCtx.createBiquadFilter();
            
            if (index === 0) {
                filter.type = 'lowshelf';
            } else if (index === this.frequencies.length - 1) {
                filter.type = 'highshelf';
            } else {
                filter.type = 'peaking';
                filter.Q.value = 1.4;
            }

            filter.frequency.value = freq;
            filter.gain.value = 0;

            previousNode.connect(filter);
            previousNode = filter;
            this.filters.push({ freq, node: filter });
        });

        // Pipeline Routing: Source -> Filters -> Master Gain -> Analyser -> Output
        previousNode.connect(this.masterGainNode);
        this.masterGainNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);

        // Start Spectrum Canvas Animation
        this.renderVisualizer();
    }

    /**
     * Resume audio context on user interaction (browser autoplay policy)
     */
    resumeContext() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /**
     * Set Gain for a specific frequency band
     */
    setBandGain(freq, gainValue) {
        const targetFilter = this.filters.find(f => f.freq === freq);
        if (targetFilter && targetFilter.node && this.audioCtx) {
            targetFilter.node.gain.setValueAtTime(gainValue, this.audioCtx.currentTime + 0.01);
        }
    }

    /**
     * Update text output near the slider
     */
    updateValueDisplay(freq, gainValue) {
        const valLabel = document.getElementById(`val-${freq}`);
        if (valLabel) {
            const formatted = gainValue > 0 ? `+${gainValue}dB` : `${gainValue}dB`;
            valLabel.textContent = formatted;
        }
    }

    /**
     * Apply a preset profile across all 10 bands
     */
    applyPreset(presetKey) {
        const profile = this.presets[presetKey];
        if (!profile) return;

        this.frequencies.forEach((freq, index) => {
            const gainVal = profile[index];
            this.setBandGain(freq, gainVal);

            // Update UI Slider
            const slider = document.getElementById(`eq-${freq}`);
            if (slider) {
                slider.value = gainVal;
            }

            this.updateValueDisplay(freq, gainVal);
        });
    }

    clearActivePresetHighlight() {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    }

    /**
     * Render Clear-Glass Spectrum Visualizer Loop
     */
    renderVisualizer() {
        if (!this.canvasCtx || !this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.animationFrameId = requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(dataArray);

            const width = this.canvas.width;
            const height = this.canvas.height;

            this.canvasCtx.clearRect(0, 0, width, height);

            const barWidth = (width / bufferLength) * 2.2;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height;

                const gradient = this.canvasCtx.createLinearGradient(0, height, 0, 0);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
                gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.9)');

                this.canvasCtx.fillStyle = gradient;
                this.canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

                x += barWidth;
            }
        };

        draw();
    }
}

// Global Instantiate
window.eqEngine = new EqualizerEngine();
