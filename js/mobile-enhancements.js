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

function installMobileMediaSession() {
    const audio = window.frequencyAudio;
    if (!audio || !('mediaSession' in navigator)) return;

    const setAction = (name, handler) => {
        try { navigator.mediaSession.setActionHandler(name, handler); } catch (_) {}
    };

    const registerTrackControls = () => {
        setAction('play', () => audio.play());
        setAction('pause', () => audio.pause());
        setAction('previoustrack', () => document.getElementById('prev-btn')?.click());
        setAction('nexttrack', () => document.getElementById('next-btn')?.click());

        // Do not let iOS fall back to the 10-second seek controls.
        setAction('seekbackward', null);
        setAction('seekforward', null);
    };

    registerTrackControls();

    // Re-register after playback starts because iOS can build the Now Playing
    // command set from the active media session rather than the initial page state.
    audio.addEventListener('play', registerTrackControls);
    audio.addEventListener('loadedmetadata', registerTrackControls);

    const syncMetadata = () => {
        if (!('MediaMetadata' in window)) return;
        const title = document.getElementById('player-title')?.textContent?.trim() || 'Frequency';
        const artist = document.getElementById('player-artist')?.textContent?.trim() || 'Unknown Artist';
        const artwork = document.getElementById('player-thumb')?.currentSrc || document.getElementById('player-thumb')?.src || '';

        navigator.mediaSession.metadata = new MediaMetadata({
            title,
            artist,
            album: 'Frequency',
            artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }] : []
        });
    };

    ['play', 'pause', 'loadedmetadata'].forEach(eventName => audio.addEventListener(eventName, syncMetadata));

    const title = document.getElementById('player-title');
    const artist = document.getElementById('player-artist');
    const thumb = document.getElementById('player-thumb');
    [title, artist, thumb].forEach(element => {
        if (!element) return;
        new MutationObserver(syncMetadata).observe(element, { childList: true, characterData: true, subtree: true, attributes: true });
    });

    syncMetadata();
}

function boot() {
    installCollectionSwipe();
    installMobileMediaSession();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
