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

    function draw() {
        ctx.clearRect(0, 0, width, height);
        phase += 0.012;

        const analyzer = window.frequencyAnalyzer;
        const data = analyzer?.getFrequencyData?.() || new Uint8Array(0);
        const waveform = analyzer?.getWaveformData?.() || new Uint8Array(0);
        const active = Boolean(data.length && analyzer?.audioElement?.paused === false);
        const count = Math.max(72, Math.floor(width / 7));
        const center = height * .51;
        const top = height * .1;
        const bottom = height * .9;
        const usable = bottom - top;

        // Mechanical scan lines and calibration marks.
        ctx.save();
        ctx.globalAlpha = active ? .38 : .16;
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        for (let i = 0; i <= 32; i += 1) {
            const x = i / 32 * width;
            const tick = i % 4 === 0 ? 8 : 3;
            ctx.fillRect(Math.round(x), height - tick - 4, 1, tick);
        }
        for (let i = 1; i < 5; i += 1) {
            const y = top + i / 5 * usable;
            ctx.fillRect(0, Math.round(y), 8, 1);
            ctx.fillRect(width - 8, Math.round(y), 8, 1);
        }
        ctx.restore();

        // Frequency columns: hard-edged, industrial, and heavily reactive.
        for (let i = 0; i < count; i += 1) {
            const t = i / (count - 1);
            const curved = Math.pow(t, 1.42);
            const index = data.length ? Math.min(data.length - 1, Math.floor(curved * (data.length - 1))) : 0;
            const raw = data.length ? data[index] / 255 : .025 + Math.sin(phase + i * .09) * .008;
            const energy = active ? Math.pow(raw, .58) : Math.pow(raw, 1.1) * .12;
            const gap = Math.max(2, width / count * .3);
            const barWidth = Math.max(1, width / count - gap);
            const x = i / count * width + gap / 2;
            const h = Math.max(2, energy * usable * .92);
            const y = center - h * .8;

            const gradient = ctx.createLinearGradient(0, y, 0, center + h * .2);
            gradient.addColorStop(0, active ? 'rgba(255,245,239,.98)' : 'rgba(255,255,255,.13)');
            gradient.addColorStop(.18, active ? 'rgba(226,48,39,.96)' : 'rgba(170,25,20,.13)');
            gradient.addColorStop(.62, active ? 'rgba(123,18,15,.68)' : 'rgba(90,12,10,.08)');
            gradient.addColorStop(1, 'rgba(40,5,4,.02)');
            ctx.fillStyle = gradient;
            ctx.shadowBlur = active && energy > .5 ? 10 : 0;
            ctx.shadowColor = 'rgba(225,35,28,.58)';
            ctx.fillRect(x, y, barWidth, h);
            ctx.shadowBlur = 0;

            if (active && energy > .7) {
                ctx.fillStyle = 'rgba(255,250,246,.98)';
                ctx.fillRect(x, Math.max(top, y - 4), barWidth, 2);
            }
        }

        // Central red signal rail.
        ctx.save();
        ctx.strokeStyle = active ? 'rgba(235,38,30,.7)' : 'rgba(170,30,25,.24)';
        ctx.lineWidth = active ? 1.2 : 1;
        ctx.shadowBlur = active ? 16 : 0;
        ctx.shadowColor = 'rgba(235,35,28,.75)';
        ctx.beginPath();
        ctx.moveTo(0, center);
        ctx.lineTo(width, center);
        ctx.stroke();
        ctx.restore();

        // Audio waveform. This is the bright "signal" running through the console.
        if (waveform.length) {
            ctx.beginPath();
            for (let i = 0; i < waveform.length; i += 1) {
                const x = i / (waveform.length - 1) * width;
                const normalized = (waveform[i] - 128) / 128;
                const y = center + normalized * height * (active ? .31 : .05);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.strokeStyle = active ? 'rgba(255,248,242,.95)' : 'rgba(255,255,255,.14)';
            ctx.lineWidth = active ? 1.35 : .8;
            ctx.shadowBlur = active ? 12 : 0;
            ctx.shadowColor = 'rgba(232,38,30,.7)';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Hard-edged display readouts.
        ctx.font = '7px monospace';
        ctx.fillStyle = active ? 'rgba(255,255,255,.62)' : 'rgba(255,255,255,.24)';
        ctx.fillText(active ? 'SIGNAL // ACTIVE' : 'SIGNAL // STANDBY', 12, 14);
        ctx.fillText('FFT 256', width - 48, 14);
        ctx.fillStyle = active ? 'rgba(213,39,31,.75)' : 'rgba(180,30,24,.22)';
        ctx.fillRect(12, height - 14, active ? 48 : 16, 2);

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}
