/**
 * FREQUENCY SPATIAL COLLECTION ENGINE
 * Scoped listeners prevent accidental clicks outside of active cards from triggering playback.
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

        this.initEventListeners();
    }

    setSongs(songs) {
        this.songs = songs;
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        if (!this.songs || this.songs.length === 0) return;

        this.songs.forEach((song, index) => {
            const el = document.createElement('div');
            el.className = 'record-object';
            el.dataset.index = index;

            const coverUrl = song.cover_url || 'assets/default-cover.jpg';
            
            el.innerHTML = `
                <div class="album-sleeve" style="background-image: url('${coverUrl}')"></div>
                <div class="vinyl-disc"></div>
            `;

            // Explicit click listener on the card itself
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectRecord(index);
            });
            
            this.container.appendChild(el);
        });

        this.updatePositions();
    }

    updatePositions() {
        const elements = this.container.querySelectorAll('.record-object');
        if (elements.length === 0) return;

        elements.forEach((el, index) => {
            const offset = index - this.currentIndex;
            const absOffset = Math.abs(offset);

            if (offset === 0) {
                // Active Center Card
                el.classList.add('active');
                el.style.transform = `translate3d(0px, -20px, 220px) rotateY(0deg) scale(1.15)`;
                el.style.zIndex = 200;
                el.style.opacity = '1';
            } else {
                // Fanned Cards to Left and Right
                el.classList.remove('active');
                const direction = offset < 0 ? -1 : 1;
                const translateX = offset * 180 + (direction * 40);
                const translateZ = -absOffset * 100;
                const rotateY = -offset * 8;

                el.style.transform = `translate3d(${translateX}px, 0px, ${translateZ}px) rotateY(${rotateY}deg) scale(${1 - absOffset * 0.08})`;
                el.style.zIndex = 100 - absOffset;
                el.style.opacity = Math.max(0.3, 1 - absOffset * 0.22).toString();
            }
        });

        // Update active metadata on pedestal
        const activeSong = this.songs[this.currentIndex];
        if (activeSong) {
            document.getElementById('activeArtist').textContent = activeSong.artist || 'ARTIST NAME';
            document.getElementById('activeTitle').textContent = activeSong.title || 'Track Title';
            document.getElementById('activeMeta').textContent = `${activeSong.year || '2026'} • ${activeSong.album || 'Single'}`;
        }
    }

    selectRecord(index) {
        this.currentIndex = index;
        this.updatePositions();
        if (this.onSelectCallback && this.songs[index]) {
            this.onSelectCallback(this.songs[index]);
        }
    }

    initEventListeners() {
        // Scope drag gesture strictly to the 3D vault container (not entire window)
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.startX = e.clientX;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const diff = e.clientX - this.startX;
            this.dragOffset = diff;
            this.updatePositions();
        });

        window.addEventListener('mouseup', () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            
            // Only cycle if dragged far enough
            if (this.dragOffset < -80 && this.currentIndex < this.songs.length - 1) {
                this.currentIndex++;
            } else if (this.dragOffset > 80 && this.currentIndex > 0) {
                this.currentIndex--;
            }
            
            this.dragOffset = 0;
            this.updatePositions();
        });
    }
}
