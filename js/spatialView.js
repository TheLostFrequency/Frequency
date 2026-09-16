/**
 * FREQUENCY SPATIAL COLLECTION ENGINE
 * Touch-swipe mobile gestures, 3D record fan animation, and metadata sync.
 */
class SpatialVault {
    constructor(containerId, onSelectCallback) {
        this.container = document.getElementById(containerId);
        this.onSelectCallback = onSelectCallback;
        this.songs = [];
        this.currentIndex = 0;
        this.isDragging = false;
        this.startX = 0;
        this.dragOffset = 0;

        if (this.container) {
            this.initEventListeners();
        }
    }

    setSongs(songs) {
        this.songs = songs;
        this.currentIndex = 0;
        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        if (!this.songs || this.songs.length === 0) return;

        this.songs.forEach((song, index) => {
            const el = document.createElement('div');
            el.className = 'record-object';
            el.dataset.index = index;

            const coverUrl = song.cover_url || 'assets/default-art.jpg';
            
            el.innerHTML = `
                <div class="album-sleeve" style="background-image: url('${coverUrl}')"></div>
                <div class="vinyl-disc"></div>
            `;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectRecord(index);
            });
            
            this.container.appendChild(el);
        });

        this.updatePositions();
    }

    updatePositions() {
        if (!this.container) return;
        const elements = this.container.querySelectorAll('.record-object');
        if (elements.length === 0) return;

        const isMobile = window.innerWidth <= 768;

        elements.forEach((el, index) => {
            const offset = index - this.currentIndex;
            const absOffset = Math.abs(offset);

            if (offset === 0) {
                el.classList.add('active');
                const scale = isMobile ? 'scale(1.05)' : 'scale(1.15)';
                el.style.transform = `translate3d(0px, -15px, 220px) rotateY(0deg) ${scale}`;
                el.style.zIndex = 200;
                el.style.opacity = '1';
            } else {
                el.classList.remove('active');
                const direction = offset < 0 ? -1 : 1;
                const spacing = isMobile ? 120 : 180;
                const translateX = offset * spacing + (direction * (isMobile ? 25 : 40));
                const translateZ = -absOffset * (isMobile ? 80 : 100);
                const rotateY = -offset * (isMobile ? 10 : 8);
                const scaleVal = Math.max(0.6, 1 - absOffset * 0.08);

                el.style.transform = `translate3d(${translateX}px, 0px, ${translateZ}px) rotateY(${rotateY}deg) scale(${scaleVal})`;
                el.style.zIndex = 100 - absOffset;
                el.style.opacity = Math.max(0.2, 1 - absOffset * 0.25).toString();
            }
        });
    }

    selectRecord(index) {
        this.currentIndex = index;
        this.updatePositions();
        if (this.onSelectCallback && this.songs[index]) {
            this.onSelectCallback(this.songs[index], index);
        }
    }

    initEventListeners() {
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.startX = e.clientX;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.dragOffset = e.clientX - this.startX;
        });

        window.addEventListener('mouseup', () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.evaluateDragThreshold();
        });

        this.container.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.startX = e.touches[0].clientX;
        }, { passive: true });

        this.container.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            this.dragOffset = e.touches[0].clientX - this.startX;
        }, { passive: true });

        this.container.addEventListener('touchend', () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.evaluateDragThreshold();
        });
    }

    evaluateDragThreshold() {
        const threshold = 50;
        if (this.dragOffset < -threshold && this.currentIndex < this.songs.length - 1) {
            this.selectRecord(this.currentIndex + 1);
        } else if (this.dragOffset > threshold && this.currentIndex > 0) {
            this.selectRecord(this.currentIndex - 1);
        }
        this.dragOffset = 0;
    }
}
