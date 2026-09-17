const canvas = document.getElementById('eq-spectrum');
const visual = document.getElementById('eq-visual');

if (canvas && visual) {
    const ctx = canvas.getContext('2d');
    let width = 1;
    let height = 1;
    let ratio = 1;
    let phase = 0;

    function resize() {
        const rect = visual.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function drawGrid() {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.055)';
        for (let i = 1; i < 12; i++) {
            const x = Math.round(width * i / 12) + .5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let i = 1; i < 7; i++) {
            const y = Math.round(height * i / 7) + .5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,25,18,.18)';
        ctx.beginPath();
        ctx.moveTo(width / 2 + .5, 0);
        ctx.lineTo(width / 2 + .5, height);
        ctx.stroke();
        ctx.restore();
    }

    function fallbackWave(x, active) {
        if (!active) return 0;
        const a = Math.sin(x * .052 + phase * 2.4) * .28;
        const b = Math.sin(x * .117 - phase * 3.1) * .14;
        const c = Math.sin(x * .213 + phase * 1.7) * .07;
        return (a + b + c) * (0.65 + Math.sin(phase * .8) * .08);
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        phase += .018;

        const analyzer = window.frequencyAnalyzer;
        const audio = analyzer?.audioElement;
        const spectrum = analyzer?.getFrequencyData?.() || new Uint8Array(0);
        const waveform = analyzer?.getWaveformData?.() || new Uint8Array(0);
        const active = Boolean(audio && !audio.paused && !audio.ended);
        const center = height * .54;

        drawGrid();

        // Live spectrum: use the real analyser data whenever it is available.
        // The fallback keeps the instrument visibly alive if the browser has not
        // exposed analyser samples yet during the first frames of playback.
        const bars = Math.max(80, Math.floor(width / 4));
        for (let i = 0; i < bars; i++) {
            const t = i / (bars - 1);
            const index = spectrum.length
                ? Math.min(spectrum.length - 1, Math.floor(Math.pow(t, 1.22) * (spectrum.length - 1)))
                : 0;
            const real = spectrum.length ? spectrum[index] / 255 : 0;
            const synthetic = Math.max(0, Math.sin(phase * 2.1 + i * .16) * .035 + Math.sin(phase * 1.3 + i * .037) * .025);
            const energy = active ? Math.max(real, synthetic) : synthetic * .18;
            const barHeight = Math.max(1, energy * height * .72);
            const x = i * width / bars;
            const barWidth = Math.max(1, width / bars - .8);
            const y = center - barHeight;

            const gradient = ctx.createLinearGradient(0, y, 0, center + 2);
            gradient.addColorStop(0, active ? 'rgba(255,250,246,.98)' : 'rgba(255,255,255,.08)');
            gradient.addColorStop(.12, active ? 'rgba(247,54,44,.98)' : 'rgba(180,25,20,.08)');
            gradient.addColorStop(.58, active ? 'rgba(151,20,16,.72)' : 'rgba(100,10,8,.04)');
            gradient.addColorStop(1, 'rgba(30,2,2,0)');
            ctx.fillStyle = gradient;
            if (active && energy > .18) {
                ctx.shadowBlur = 7;
                ctx.shadowColor = 'rgba(255,28,20,.48)';
            }
            ctx.fillRect(x, y, barWidth, barHeight);
            ctx.shadowBlur = 0;
        }

        // Bright mirrored waveform/oscilloscope line. This is the actual time-domain
        // signal from the AudioAnalyzer when available, not a static decoration.
        ctx.beginPath();
        const points = Math.max(160, Math.floor(width));
        for (let i = 0; i < points; i++) {
            const x = i / (points - 1) * width;
            let sample;
            if (waveform.length) {
                const index = Math.min(waveform.length - 1, Math.floor(i / points * waveform.length));
                sample = (waveform[index] - 128) / 128;
            } else {
                sample = fallbackWave(x, active);
            }
            const y = center + sample * height * (active ? .30 : .012);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = active ? 'rgba(255,249,244,.98)' : 'rgba(255,255,255,.12)';
        ctx.lineWidth = active ? 1.7 : .8;
        ctx.shadowBlur = active ? 11 : 0;
        ctx.shadowColor = 'rgba(240,30,23,.88)';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Second, quieter trace makes the live signal feel like a physical scope.
        if (active) {
            ctx.beginPath();
            for (let i = 0; i < points; i++) {
                const x = i / (points - 1) * width;
                let sample = waveform.length
                    ? (waveform[Math.min(waveform.length - 1, Math.floor(i / points * waveform.length))] - 128) / 128
                    : fallbackWave(x + 18, true);
                const y = center - sample * height * .15;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.strokeStyle = 'rgba(205,35,28,.38)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.strokeStyle = active ? 'rgba(229,38,30,.72)' : 'rgba(160,25,20,.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, center + .5);
        ctx.lineTo(width, center + .5);
        ctx.stroke();

        ctx.font = '7px monospace';
        ctx.fillStyle = active ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.24)';
        ctx.fillText(active ? 'SIGNAL ACTIVE' : 'SIGNAL STANDBY', 12, 15);
        ctx.fillText('LIVE FREQUENCY RESPONSE', 12, height - 10);
        ctx.fillText('FFT 512', width - 48, 15);

        ctx.fillStyle = active ? 'rgba(220,34,27,.95)' : 'rgba(120,18,14,.32)';
        ctx.fillRect(width - 62, height - 15, active ? 50 : 13, 2);

        if (active) {
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.fillStyle = `rgba(232,38,30,${.22 + i * .12})`;
                ctx.arc(width - 14 - i * 9, height - 8, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}
