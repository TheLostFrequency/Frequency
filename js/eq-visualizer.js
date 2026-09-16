const canvas = document.getElementById('eq-spectrum');
const visual = document.getElementById('eq-visual');

if (canvas && visual) {
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let ratio = 1;
    let idlePhase = 0;

    function resize() {
        const rect = visual.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        const analyzer = window.frequencyAnalyzer;
        const data = analyzer?.getFrequencyData?.() || new Uint8Array(0);
        const active = data.length > 0 && analyzer?.audioElement?.paused === false;
        const points = Math.max(96, Math.floor(width / 5));
        const values = [];

        for (let i = 0; i < points; i += 1) {
            if (data.length) {
                const normalized = i / (points - 1);
                const curved = Math.pow(normalized, 1.72);
                const index = Math.min(data.length - 1, Math.floor(curved * (data.length - 1)));
                const raw = data[index] / 255;
                values.push(active ? Math.pow(raw, 0.72) : Math.pow(raw, 1.15) * 0.32);
            } else {
                idlePhase += 0.002;
                values.push(0.018 + Math.sin(idlePhase + i * 0.075) * 0.006);
            }
        }

        const center = height * 0.52;
        const maxHeight = height * 0.39;
        const step = width / (points - 1);

        // Fine frequency tick marks behind the signal.
        ctx.save();
        ctx.globalAlpha = 0.28;
        for (let i = 0; i <= 16; i += 1) {
            const x = (i / 16) * width;
            ctx.fillStyle = 'rgba(255,255,255,.55)';
            ctx.fillRect(Math.round(x), height - 9, 1, i % 4 === 0 ? 5 : 2);
        }
        ctx.restore();

        // Mirrored energy field: the spectrum now reads as a living signal, not a single line.
        ctx.beginPath();
        values.forEach((value, i) => {
            const x = i * step;
            const y = center - value * maxHeight;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        for (let i = values.length - 1; i >= 0; i -= 1) {
            const x = i * step;
            const y = center + values[i] * maxHeight * 0.58;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        const field = ctx.createLinearGradient(0, 0, 0, height);
        field.addColorStop(0, 'rgba(210,42,31,.02)');
        field.addColorStop(.48, active ? 'rgba(205,40,30,.22)' : 'rgba(205,40,30,.05)');
        field.addColorStop(1, 'rgba(205,40,30,.015)');
        ctx.fillStyle = field;
        ctx.fill();

        // Main spectral contour.
        ctx.beginPath();
        values.forEach((value, i) => {
            const x = i * step;
            const y = center - value * maxHeight;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = active ? 'rgba(255,244,232,.96)' : 'rgba(255,255,255,.28)';
        ctx.lineWidth = active ? 1.55 : 1;
        ctx.shadowBlur = active ? 12 : 0;
        ctx.shadowColor = 'rgba(196,42,32,.7)';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Second contour below the center line gives the spectrum depth.
        ctx.beginPath();
        values.forEach((value, i) => {
            const x = i * step;
            const y = center + value * maxHeight * 0.58;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = active ? 'rgba(196,42,32,.7)' : 'rgba(255,255,255,.13)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Bright peak particles along stronger parts of the spectrum.
        if (active) {
            ctx.fillStyle = 'rgba(255,238,224,.9)';
            for (let i = 3; i < values.length - 3; i += 4) {
                if (values[i] > 0.28 && values[i] >= values[i - 1] && values[i] >= values[i + 1]) {
                    const x = i * step;
                    const y = center - values[i] * maxHeight;
                    ctx.beginPath();
                    ctx.arc(x, y, values[i] > 0.65 ? 1.7 : 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}
