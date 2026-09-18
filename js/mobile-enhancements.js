/* FREQUENCY // MOBILE PLAYBACK + COLLECTION GESTURES */

const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

function installCollectionSwipe() {
    const art = document.querySelector('#room-collection .hero-art');
    if (!art || art.dataset.swipeReady === 'true') return;

    art.dataset.swipeReady = 'true';
    let startX = 0;
    let startY = 0;
    let tracking = false;

    art.addEventListener('touchstart', event => {
        if (!isMobile() || event.touches.length !== 1) return;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        tracking = true;
    }, { passive: true });

    art.addEventListener('touchend', event => {
        if (!tracking || !isMobile()) return;
        tracking = false;

        const touch = event.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.25) return;

        const buttonId = dx < 0 ? 'next-btn' : 'prev-btn';
        document.getElementById(buttonId)?.click();
    }, { passive: true });
}

function boot() {
    installCollectionSwipe();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
