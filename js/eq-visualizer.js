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
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        const analyzer = window.frequencyAnalyzer;
        const data = analyzer?.getFrequencyData?.() || new Uint8Array(0);
        const active = data.length > 0;
        const points = 96;
        const values = [];

        for (let i = 0; i < points; i += 1) {
            if (active) {
                const normalized = i / (points - 1);
                const curved = Math.pow(normalized, 2.2);
                const index = Math.min(data.length - 1, Math.floor(curved * data.length));
                values.push(data[index] / 255);
            } else {
                idlePhase += 0.003;
                values.push(0.035 + Math.sin(idlePhase + i * 0.09) * 0.012);
            }
        }

        const baseline = height * 0.76;
        const maxHeight = height * 0.64;
        const step = width / (points - 1);

        ctx.beginPath();
        values.forEach((value, i) => {
            const x = i * step;
            const y = baseline - value * maxHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.lineTo(width, baseline);
        ctx.lineTo(0, baseline);
        ctx.closePath();
        ctx.fillStyle = 'rgba(150, 24, 20, .10)';
        ctx.fill();

        ctx.beginPath();
        values.forEach((value, i) => {
            const x = i * step;
            const y = baseline - value * maxHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = active ? 'rgba(238, 232, 220, .72)' : 'rgba(255,255,255,.22)';
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = active ? 10 : 0;
        ctx.shadowColor = 'rgba(196,42,32,.35)';
        ctx.stroke();
        ctx.shadowBlur = 0;

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}
