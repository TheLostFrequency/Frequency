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
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let i = 1; i < 7; i++) {
            const y = Math.round(height * i / 7) + .5;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,25,18,.16)';
        ctx.beginPath(); ctx.moveTo(width / 2 + .5, 0); ctx.lineTo(width / 2 + .5, height); ctx.stroke();
        ctx.restore();
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        phase += .018;

        const analyzer = window.frequencyAnalyzer;
        const spectrum = analyzer?.getFrequencyData?.() || new Uint8Array(0);
        const waveform = analyzer?.getWaveformData?.() || new Uint8Array(0);
        const active = Boolean(analyzer?.isInitialized && analyzer?.audioElement?.paused === false);
        const center = height * .52;
        const usable = height * .78;

        drawGrid();

        // Spectrum is drawn as dense vertical signal columns, rising and falling with the music.
        const bars = Math.max(70, Math.floor(width / 5));
        for (let i = 0; i < bars; i++) {
            const t = i / (bars - 1);
            const index = spectrum.length
                ? Math.min(spectrum.length - 1, Math.floor(Math.pow(t, 1.32) * (spectrum.length - 1)))
                : 0;
            const raw = spectrum.length ? spectrum[index] / 255 : .015;
            const idlePulse = .012 + Math.max(0, Math.sin(phase * 1.4 + i * .12)) * .006;
            const energy = active ? Math.pow(raw, .55) : idlePulse;
            const barHeight = Math.max(1.5, energy * usable * .92);
            const x = i * width / bars + .5;
            const barWidth = Math.max(1, width / bars - 1.5);
            const y = center - barHeight;

            const gradient = ctx.createLinearGradient(0, y, 0, center + barHeight * .2);
            gradient.addColorStop(0, active ? 'rgba(255,247,241,.98)' : 'rgba(255,255,255,.08)');
            gradient.addColorStop(.08, active ? 'rgba(247,54,44,.98)' : 'rgba(180,25,20,.08)');
            gradient.addColorStop(.48, active ? 'rgba(151,20,16,.8)' : 'rgba(100,10,8,.05)');
            gradient.addColorStop(1, 'rgba(30,2,2,0)');
            ctx.fillStyle = gradient;
            if (active && energy > .58) {
                ctx.shadowBlur = 9;
                ctx.shadowColor = 'rgba(255,28,20,.65)';
            }
            ctx.fillRect(x, y, barWidth, barHeight);
            ctx.shadowBlur = 0;

            if (active && energy > .72) {
                ctx.fillStyle = 'rgba(255,251,247,.95)';
                ctx.fillRect(x, Math.max(1, y - 3), barWidth, 2);
            }
        }

        // The waveform is the primary live signal blade across the monitor.
        if (waveform.length) {
            ctx.beginPath();
            for (let i = 0; i < waveform.length; i++) {
                const x = i / (waveform.length - 1) * width;
                const sample = (waveform[i] - 128) / 128;
                const y = center + sample * height * (active ? .31 : .018);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.strokeStyle = active ? 'rgba(255,249,244,.98)' : 'rgba(255,255,255,.12)';
            ctx.lineWidth = active ? 1.8 : .8;
            ctx.shadowBlur = active ? 13 : 0;
            ctx.shadowColor = 'rgba(240,30,23,.9)';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Central machine rail.
        ctx.strokeStyle = active ? 'rgba(229,38,30,.72)' : 'rgba(160,25,20,.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, center + .5); ctx.lineTo(width, center + .5); ctx.stroke();

        // Physical-instrument readouts.
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
