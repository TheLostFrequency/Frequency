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

    function getValues(data, count, active) {
        const values = new Array(count);
        for (let i = 0; i < count; i += 1) {
            if (!data.length) {
                values[i] = 0.025 + Math.sin(phase + i * 0.11) * 0.008;
                continue;
            }
            const t = i / (count - 1);
            const curved = Math.pow(t, 1.55);
            const index = Math.min(data.length - 1, Math.floor(curved * (data.length - 1)));
            const raw = data[index] / 255;
            values[i] = active ? Math.pow(raw, 0.62) : Math.pow(raw, 1.15) * 0.12;
        }
        return values;
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        phase += 0.018;

        const analyzer = window.frequencyAnalyzer;
        const data = analyzer?.getFrequencyData?.() || new Uint8Array(0);
        const waveform = analyzer?.getWaveformData?.() || new Uint8Array(0);
        const active = Boolean(data.length && analyzer?.audioElement?.paused === false);
        const count = Math.max(64, Math.floor(width / 8));
        const values = getValues(data, count, active);
        const center = height * 0.53;
        const top = height * 0.09;
        const bottom = height * 0.91;
        const usable = bottom - top;
        const gap = Math.max(2, width / count * 0.22);
        const barWidth = Math.max(1.5, width / count - gap);

        // Instrument readout ticks.
        ctx.save();
        ctx.globalAlpha = active ? 0.42 : 0.18;
        ctx.fillStyle = 'rgba(255,255,255,.65)';
        for (let i = 0; i <= 24; i += 1) {
            const x = i / 24 * width;
            const tick = i % 4 === 0 ? 7 : 3;
            ctx.fillRect(Math.round(x), height - tick - 3, 1, tick);
        }
        ctx.restore();

        // Frequency energy columns.
        for (let i = 0; i < count; i += 1) {
            const x = i / count * width + gap / 2;
            const energy = Math.max(0.012, values[i]);
            const h = energy * usable * 0.82;
            const y = center - h * 0.78;

            const gradient = ctx.createLinearGradient(0, y, 0, center + h * 0.28);
            gradient.addColorStop(0, active ? 'rgba(255,238,228,.95)' : 'rgba(255,255,255,.16)');
            gradient.addColorStop(.32, active ? 'rgba(239,68,52,.9)' : 'rgba(196,42,32,.13)');
            gradient.addColorStop(1, 'rgba(105,17,14,.05)');
            ctx.fillStyle = gradient;
            ctx.shadowBlur = active && energy > .45 ? 9 : 0;
            ctx.shadowColor = 'rgba(231,42,32,.55)';
            ctx.fillRect(x, y, barWidth, h);
            ctx.shadowBlur = 0;

            if (active && energy > .64) {
                ctx.fillStyle = 'rgba(255,245,238,.95)';
                ctx.fillRect(x, Math.max(top, y - 3), barWidth, 1.5);
            }
        }

        // Central signal spine.
        ctx.save();
        ctx.strokeStyle = active ? 'rgba(255,55,43,.5)' : 'rgba(255,55,43,.22)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = active ? 14 : 0;
        ctx.shadowColor = 'rgba(255,42,32,.7)';
        ctx.beginPath();
        ctx.moveTo(0, center);
        ctx.lineTo(width, center);
        ctx.stroke();
        ctx.restore();

        // Real time waveform layered over the spectrum.
        if (waveform.length) {
            ctx.beginPath();
            for (let i = 0; i < waveform.length; i += 1) {
                const x = i / (waveform.length - 1) * width;
                const normalized = (waveform[i] - 128) / 128;
                const y = center + normalized * height * (active ? .27 : .08);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.strokeStyle = active ? 'rgba(255,248,242,.9)' : 'rgba(255,255,255,.18)';
            ctx.lineWidth = active ? 1.15 : .8;
            ctx.shadowBlur = active ? 10 : 0;
            ctx.shadowColor = 'rgba(255,49,39,.65)';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Corner readouts make the visualizer feel like a physical signal instrument.
        ctx.font = '6px sans-serif';
        ctx.letterSpacing = '2px';
        ctx.fillStyle = active ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.22)';
        ctx.fillText(active ? 'SIGNAL LOCKED' : 'STANDBY', 10, 13);
        ctx.fillText('FFT / LIVE', width - 48, 13);

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}
