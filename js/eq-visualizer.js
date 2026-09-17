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
        ctx.strokeStyle = 'rgba(255,25,18,.18)';
        ctx.beginPath(); ctx.moveTo(width / 2 + .5, 0); ctx.lineTo(width / 2 + .5, height); ctx.stroke();
        ctx.restore();
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        phase += .018;

        const analyzer = window.frequencyAnalyzer;
        const audio = analyzer?.audioElement;
        const spectrum = analyzer?.getFrequencyData?.() || new Uint8Array(0);
        const waveform = analyzer?.getWaveformData?.() || new Uint8Array(0);
        const active = Boolean(audio && !audio.paused && !audio.ended && analyzer?.analyser);
        const center = height * .54;

        drawGrid();

        if (active && spectrum.length) {
            const bars = Math.max(80, Math.floor(width / 4));
            for (let i = 0; i < bars; i++) {
                const t = i / (bars - 1);
                const index = Math.min(spectrum.length - 1, Math.floor(Math.pow(t, 1.22) * (spectrum.length - 1)));
                const raw = spectrum[index] / 255;
                const energy = Math.pow(raw, .55);
                const barHeight = Math.max(1.5, energy * height * .86);
                const x = i * width / bars;
                const barWidth = Math.max(1, width / bars - .8);
                const y = center - barHeight;
                const gradient = ctx.createLinearGradient(0, y, 0, center + 2);
                gradient.addColorStop(0, 'rgba(255,250,246,.98)');
                gradient.addColorStop(.12, 'rgba(247,54,44,.98)');
                gradient.addColorStop(.58, 'rgba(151,20,16,.72)');
                gradient.addColorStop(1, 'rgba(30,2,2,0)');
                ctx.fillStyle = gradient;
                if (energy > .18) {
                    ctx.shadowBlur = 7;
                    ctx.shadowColor = 'rgba(255,28,20,.48)';
                }
                ctx.fillRect(x, y, barWidth, barHeight);
                ctx.shadowBlur = 0;
            }
        }

        if (waveform.length) {
            ctx.beginPath();
            const points = Math.max(160, Math.floor(width));
            for (let i = 0; i < points; i++) {
                const x = i / (points - 1) * width;
                const index = Math.min(waveform.length - 1, Math.floor(i / points * waveform.length));
                const sample = (waveform[index] - 128) / 128;
                const y = center + sample * height * (active ? .38 : .018);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.strokeStyle = active ? 'rgba(255,249,244,.99)' : 'rgba(255,255,255,.12)';
            ctx.lineWidth = active ? 1.9 : .8;
            ctx.shadowBlur = active ? 12 : 0;
            ctx.shadowColor = 'rgba(240,30,23,.9)';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.strokeStyle = active ? 'rgba(229,38,30,.72)' : 'rgba(160,25,20,.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, center + .5); ctx.lineTo(width, center + .5); ctx.stroke();

        ctx.font = '7px monospace';
        ctx.fillStyle = active ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.24)';
        ctx.fillText(active ? 'SIGNAL ACTIVE' : 'SIGNAL STANDBY', 12, 15);
        ctx.fillText('LIVE FREQUENCY RESPONSE', 12, height - 10);
        ctx.fillText('FFT 1024', width - 50, 15);

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
