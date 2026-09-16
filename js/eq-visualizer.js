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
        phase += .015;

        const analyzer = window.frequencyAnalyzer;
        const spectrum = analyzer?.getFrequencyData?.() || new Uint8Array(0);
        const waveform = analyzer?.getWaveformData?.() || new Uint8Array(0);
        const active = Boolean(spectrum.length && analyzer?.audioElement?.paused === false);
        const center = height * .51;
        const top = height * .08;
        const usable = height * .84;
        const bars = Math.max(64, Math.floor(width / 6));

        // Precision calibration grid.
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.055)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 8; i++) {
            const x = width * i / 8;
            ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, height - top); ctx.stroke();
        }
        for (let i = 1; i < 5; i++) {
            const y = top + usable * i / 5;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
        ctx.restore();

        // Aggressive frequency spectrum columns.
        for (let i = 0; i < bars; i++) {
            const t = i / (bars - 1);
            const index = spectrum.length
                ? Math.min(spectrum.length - 1, Math.floor(Math.pow(t, 1.38) * (spectrum.length - 1)))
                : 0;
            const raw = spectrum.length ? spectrum[index] / 255 : .018 + Math.sin(phase + i * .11) * .008;
            const energy = active ? Math.pow(raw, .52) : Math.pow(raw, 1.2) * .15;
            const barWidth = Math.max(1, width / bars - 2);
            const x = i * width / bars + 1;
            const h = Math.max(2, energy * usable * .9);
            const y = center - h * .72;

            const gradient = ctx.createLinearGradient(0, y, 0, center + h * .18);
            gradient.addColorStop(0, active ? 'rgba(255,249,244,.98)' : 'rgba(255,255,255,.1)');
            gradient.addColorStop(.13, active ? 'rgba(241,54,45,.98)' : 'rgba(160,20,16,.1)');
            gradient.addColorStop(.55, active ? 'rgba(128,15,12,.75)' : 'rgba(80,8,6,.06)');
            gradient.addColorStop(1, 'rgba(25,2,2,.01)');
            ctx.fillStyle = gradient;
            ctx.shadowBlur = active && energy > .55 ? 9 : 0;
            ctx.shadowColor = 'rgba(230,35,28,.65)';
            ctx.fillRect(x, y, barWidth, h);
            ctx.shadowBlur = 0;

            if (active && energy > .72) {
                ctx.fillStyle = 'rgba(255,252,249,.95)';
                ctx.fillRect(x, Math.max(top, y - 4), barWidth, 2);
            }
        }

        // Waveform: bright central signal blade.
        if (waveform.length) {
            ctx.beginPath();
            for (let i = 0; i < waveform.length; i++) {
                const x = i / (waveform.length - 1) * width;
                const n = (waveform[i] - 128) / 128;
                const y = center + n * height * (active ? .27 : .025);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.strokeStyle = active ? 'rgba(255,248,243,.98)' : 'rgba(255,255,255,.12)';
            ctx.lineWidth = active ? 1.7 : .8;
            ctx.shadowBlur = active ? 13 : 0;
            ctx.shadowColor = 'rgba(235,35,28,.8)';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Central laser rail.
        ctx.strokeStyle = active ? 'rgba(231,38,30,.78)' : 'rgba(175,28,23,.22)';
        ctx.lineWidth = active ? 1.2 : 1;
        ctx.shadowBlur = active ? 15 : 0;
        ctx.shadowColor = '#ed3128';
        ctx.beginPath(); ctx.moveTo(0, center); ctx.lineTo(width, center); ctx.stroke();
        ctx.shadowBlur = 0;

        // Mechanical readouts.
        ctx.font = '7px monospace';
        ctx.fillStyle = active ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.25)';
        ctx.fillText(active ? 'SIGNAL ACTIVE' : 'SIGNAL STANDBY', 12, 15);
        ctx.fillText('FREQ RESPONSE', 12, height - 12);
        ctx.fillText('FFT 512', width - 48, 15);
        ctx.fillStyle = active ? 'rgba(219,38,31,.95)' : 'rgba(130,18,14,.35)';
        ctx.fillRect(width - 60, height - 14, active ? 48 : 14, 2);

        // Small red status lamps.
        if (active) {
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.fillStyle = `rgba(230,40,32,${.28 + i * .12})`;
                ctx.arc(width - 18 - i * 9, height - 8, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}
