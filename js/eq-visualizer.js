const canvas = document.getElementById('eq-spectrum');
const visual = document.getElementById('eq-visual');

if (canvas && visual) {
    const ctx = canvas.getContext('2d');
    let width = 1;
    let height = 1;
    let ratio = 1;
    let smoothWave = [];

    function resize() {
        const rect = visual.getBoundingClientRect();
        // The EQ room is hidden when the page first loads, so its canvas can
        // initially measure 0x0. Re-measuring when the room becomes visible
        // is what makes the visualizer work without needing DevTools to force
        // a browser resize.
        if (rect.width <= 1 || rect.height <= 1) return;

        width = rect.width;
        height = rect.height;
        ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        smoothWave = [];
    }

    function drawGrid() {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.028)';
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
        ctx.restore();
    }

    function drawWave(waveform, active) {
        if (!waveform.length || width <= 1 || height <= 1) return;

        const points = Math.max(180, Math.floor(width * 0.95));
        const target = new Float32Array(points);

        for (let i = 0; i < points; i++) {
            const position = i / (points - 1);
            const index = Math.min(waveform.length - 1, Math.floor(position * waveform.length));
            target[i] = (waveform[index] - 128) / 128;
        }

        if (smoothWave.length !== points) {
            smoothWave = Array.from(target);
        }

        for (let i = 0; i < points; i++) {
            const current = smoothWave[i] || 0;
            smoothWave[i] = current + (target[i] - current) * (active ? 0.22 : 0.035);
        }

        const center = height * 0.53;
        const amplitude = active ? height * 0.68 : height * 0.012;

        ctx.beginPath();
        for (let i = 0; i < points; i++) {
            const x = i / (points - 1) * width;
            const y = center + smoothWave[i] * amplitude;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = active ? 'rgba(205,28,21,.25)' : 'rgba(120,20,18,.06)';
        ctx.lineWidth = active ? 7 : 1;
        ctx.shadowBlur = active ? 22 : 0;
        ctx.shadowColor = 'rgba(210,25,20,.42)';
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        for (let i = 0; i < points; i++) {
            const x = i / (points - 1) * width;
            const y = center + smoothWave[i] * amplitude;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = active ? 'rgba(255,247,241,.98)' : 'rgba(255,255,255,.13)';
        ctx.lineWidth = active ? 1.65 : .75;
        ctx.shadowBlur = active ? 10 : 0;
        ctx.shadowColor = 'rgba(235,30,24,.82)';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function draw() {
        // If the room was hidden during startup, catch its real dimensions as
        // soon as it becomes visible. This is intentionally checked every
        // frame as a fallback for browsers where ResizeObserver is delayed.
        const rect = visual.getBoundingClientRect();
        if (rect.width > 1 && rect.height > 1 &&
            (Math.abs(rect.width - width) > 1 || Math.abs(rect.height - height) > 1)) {
            resize();
        }

        ctx.clearRect(0, 0, width, height);

        const analyzer = window.frequencyAnalyzer;
        const audio = analyzer?.audioElement;
        const waveform = analyzer?.getWaveformData?.() || new Uint8Array(0);
        const active = Boolean(
            audio &&
            !audio.paused &&
            !audio.ended &&
            analyzer?.analyser &&
            analyzer?.audioCtx?.state === 'running'
        );

        drawGrid();
        drawWave(waveform, active);

        const center = height * 0.53;
        ctx.strokeStyle = active ? 'rgba(180,31,25,.18)' : 'rgba(160,25,20,.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, center + .5);
        ctx.lineTo(width, center + .5);
        ctx.stroke();

        ctx.font = '7px monospace';
        ctx.fillStyle = active ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.20)';
        ctx.fillText(active ? 'SIGNAL ACTIVE' : 'SIGNAL STANDBY', 12, 15);
        ctx.fillText('LIVE WAVEFORM', 12, height - 10);

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);

    if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(() => resize());
        observer.observe(visual);
    }

    // The room switches between display states by changing its class. This
    // catches that transition immediately even when its dimensions change
    // without a conventional window resize.
    const room = document.getElementById('room-equalizer');
    if (room && 'MutationObserver' in window) {
        const observer = new MutationObserver(() => resize());
        observer.observe(room, { attributes: true, attributeFilter: ['class'] });
    }

    resize();
    draw();
}
