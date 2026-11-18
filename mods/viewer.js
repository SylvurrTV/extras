// Image viewer with zoom/pinch/drag/swipe/browse
(function () {
    const imgs = Array.from(document.querySelectorAll(".screenshot-grid img"));
    if (!imgs.length) return;

    const viewer = document.getElementById("image-viewer");
    const viewerImg = document.getElementById("viewer-image");
    const container = document.getElementById("viewer-container");
    const closeBtn = document.getElementById("viewer-close");
    const prevBtn = document.getElementById("viewer-prev");
    const nextBtn = document.getElementById("viewer-next");
    const caption = document.getElementById("viewer-caption");

    let baseScale = 1; // scale that fits the image on screen
    let currentIndex = 0;
    let scale = 1;
    let MIN_SCALE = 1;
    const MAX_SCALE = 5;
    let posX = 0, posY = 0; // translation relative to center
    let dragStartX = 0, dragStartY = 0;
    let dragging = false;

    // Touch/pinch state
    let isPinching = false;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let lastTouchCenter = null;

    // Double-tap detection
    let lastTap = 0;

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function openViewer(index) {
        currentIndex = clamp(index, 0, imgs.length - 1);
        const src = imgs[currentIndex].src;
        const alt = imgs[currentIndex].alt || "";
        viewerImg.onload = () => {
            calculateBaseScale();
            resetTransform();
            clampPan();
        };
        viewerImg.src = src;
        viewerImg.alt = alt;
        caption.textContent = alt;
        viewer.classList.add("active");
        viewer.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        resetTransform();
    }

    function closeViewer() {
        viewer.classList.remove("active");
        viewer.setAttribute("aria-hidden", "true");
        viewerImg.src = "";
        document.body.style.overflow = "";
    }

    imgs.forEach((img, i) => {
        img.style.touchAction = "manipulation";
        img.addEventListener("click", () => openViewer(i));
        img.addEventListener("keydown", (e) => { if (e.key === "Enter") openViewer(i); });
    });

    closeBtn.addEventListener("click", closeViewer);
    prevBtn.addEventListener("click", showPrev);
    nextBtn.addEventListener("click", showNext);

    viewer.addEventListener("click", (e) => {
        // only close when clicking background overlay (not buttons or container)
        if (e.target === viewer) closeViewer();
    });

        // keyboard
        document.addEventListener("keydown", (e) => {
            if (!viewer.classList.contains("active")) return;
            if (e.key === "Escape") closeViewer();
            if (e.key === "ArrowLeft") showPrev();
            if (e.key === "ArrowRight") showNext();
        });

            function showPrev() {
                if (currentIndex > 0) openViewer(currentIndex - 1);
                else openViewer(imgs.length - 1); // wrap-around
            }
            function showNext() {
                if (currentIndex < imgs.length - 1) openViewer(currentIndex + 1);
                else openViewer(0); // wrap-around
            }

            // Transform application
            function applyTransform() {
                viewerImg.style.transform = `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;
            }

            function resetTransform() {
                scale = baseScale;
                posX = 0;
                posY = 0;
                applyTransform();
            }

            // compute clamp bounds for panning based on image natural size and container
            function clampPan() {
                const cRect = container.getBoundingClientRect();
                const cw = cRect.width;
                const ch = cRect.height;
                const iw = viewerImg.naturalWidth || viewerImg.width;
                const ih = viewerImg.naturalHeight || viewerImg.height;

                // If image natural size unknown, bail
                if (!iw || !ih) return;

                const displayW = iw * scale;
                const displayH = ih * scale;

                const maxX = Math.max(0, (displayW - cw) / 2);
                const maxY = Math.max(0, (displayH - ch) / 2);

                posX = clamp(posX, -maxX, maxX);
                posY = clamp(posY, -maxY, maxY);
            }

            // Zoom keeping the screen point (cx,cy) fixed relative to image center
            function zoomAt(newScale, cx, cy) {
                newScale = clamp(newScale, MIN_SCALE, MAX_SCALE);
                if (newScale === scale) return;

                const cRect = container.getBoundingClientRect();
                // center of container
                const centerX = cRect.left + cRect.width / 2;
                const centerY = cRect.top + cRect.height / 2;
                // vector from image center to pointer
                const relX = cx - centerX;
                const relY = cy - centerY;

                // adjust pos so that the point remains under the pointer after scale change:
                posX = posX - relX * (newScale / scale - 1);
                posY = posY - relY * (newScale / scale - 1);

                scale = newScale;
                clampPan();
                applyTransform();
            }

            container.addEventListener("wheel", (e) => {
                if (!viewer.classList.contains("active")) return;
                e.preventDefault();

                const zoomIntensity = 0.12;
                const direction = e.deltaY < 0 ? 1 : -1;
                const factor = 1 + zoomIntensity * direction;

                const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
                if (newScale === scale) return;

                zoomAtPoint(newScale, e.clientX, e.clientY);
            }, { passive: false });

            // Pointer (mouse) drag for pan
            container.addEventListener("pointerdown", (e) => {
                if (!viewer.classList.contains("active")) return;
                // don't start pointer pan when multiple active touches (handled in touch handlers)
                if (e.pointerType === "touch") return;
                dragging = true;
                dragStartX = e.clientX - posX;
                dragStartY = e.clientY - posY;
                container.setPointerCapture(e.pointerId);
            });

            container.addEventListener("pointermove", (e) => {
                if (!dragging) return;
                posX = e.clientX - dragStartX;
                posY = e.clientY - dragStartY;
                clampPan();
                applyTransform();
            });

            container.addEventListener("pointerup", (e) => {
                if (e.pointerType === "touch") return;
                dragging = false;
                try { container.releasePointerCapture(e.pointerId); } catch (err) {}
            });

            // DOUBLE-CLICK (mouse)
            container.addEventListener("dblclick", (e) => {
                if (!viewer.classList.contains("active")) return;
                if (scale === 1) {
                    zoomAt(2.5, e.clientX, e.clientY);
                } else {
                    zoomAt(1, e.clientX, e.clientY);
                }
            });

            // TOUCH HANDLING - separate from pointer events for reliable pinch detection
            let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
            container.addEventListener("touchstart", (e) => {
                if (!viewer.classList.contains("active")) return;
                if (e.touches.length === 1 && imageOverflowsViewport()) {
                    const t = e.touches[0];
                    dragging = true;
                    dragStartX = t.clientX - posX;
                    dragStartY = t.clientY - posY;
                } else if (e.touches.length === 2) {
                    // pinch start
                    isPinching = true;
                    const t0 = e.touches[0], t1 = e.touches[1];
                    pinchStartDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
                    pinchStartScale = scale;
                    lastTouchCenter = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
                }
            }, { passive: true });

            container.addEventListener("touchmove", (e) => {
                if (!viewer.classList.contains("active")) return;
                if (isPinching && e.touches.length === 2) {
                    e.preventDefault(); // prevent page pinch-zoom
                    const t0 = e.touches[0], t1 = e.touches[1];
                    const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
                    const newScale = clamp(pinchStartScale * (dist / pinchStartDist), MIN_SCALE, MAX_SCALE);
                    const center = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
                    zoomAt(newScale, center.x, center.y);
                    lastTouchCenter = center;
                } else if (e.touches.length === 1 && scale > 1) {
                    // single-finger pan while zoomed
                    e.preventDefault();
                    const t = e.touches[0];
                    // compute delta from last known touch (use dragging variables)
                    if (!dragging) {
                        dragging = true;
                        dragStartX = t.clientX - posX;
                        dragStartY = t.clientY - posY;
                    }
                    posX = t.clientX - dragStartX;
                    posY = t.clientY - dragStartY;
                    clampPan();
                    applyTransform();
                }
            }, { passive: false });

            container.addEventListener("touchend", (e) => {
                // handle pinch end
                if (isPinching && e.touches.length < 2) isPinching = false;
                // end single-finger drag
                dragging = false;

                // detect double-tap (only when not pinching)
                const now = Date.now();
                if (e.changedTouches && e.changedTouches.length === 1) {
                    const t = e.changedTouches[0];
                    const dt = now - lastTap;
                    const dist = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);
                    if (dt < 300 && dist < 20) {
                        // double-tap detected
                        if (scale <= baseScale + 0.01) {
                            zoomAtPoint(baseScale * 2.5, t.clientX, t.clientY);
                        } else {
                            zoomAtPoint(baseScale, t.clientX, t.clientY);
                        }
                        lastTap = 0;
                        return;
                    }
                    lastTap = now;

                    // swipe-to-browse when not zoomed (scale === 1)
                    const dx = t.clientX - touchStartX;
                    const dy = t.clientY - touchStartY;
                    const dtTouch = now - touchStartTime;
                    if (scale === 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && dtTouch < 500) {
                        if (dx < 0) showNext(); else showPrev();
                    }
                }
            }, { passive: true });

            // If user resizes window, clamp pan again
            window.addEventListener("resize", () => { if (viewer.classList.contains("active")) { clampPan(); applyTransform(); } });

            // Helper: ensure panning bounds after major interactions
            container.addEventListener("touchcancel", () => { dragging = false; isPinching = false; });

            // Ensure image is centered & clamped on load
            viewerImg.addEventListener("load", () => { clampPan(); applyTransform(); });

            // Prevent double-tap-to-zoom default in iOS Safari (optional but helpful)
            // Note: keep passive true/false choices above to allow preventDefault where needed.

            function calculateBaseScale() {
                const cRect = container.getBoundingClientRect();
                const cw = cRect.width;
                const ch = cRect.height;

                const iw = viewerImg.naturalWidth;
                const ih = viewerImg.naturalHeight;
                if (!iw || !ih) return 1;

                const scaleX = cw / iw;
                const scaleY = ch / ih;

                // fit whole image inside viewport (contain)
                baseScale = Math.min(scaleX, scaleY);

                // never upscale tiny images on open
                baseScale = Math.min(baseScale, 1);

                MIN_SCALE = baseScale;
            }

            function zoomAtPoint(newScale, clientX, clientY) {
                const rect = container.getBoundingClientRect();

                // Mouse position relative to container center
                const cx = clientX - (rect.left + rect.width / 2);
                const cy = clientY - (rect.top + rect.height / 2);

                // Scale ratio
                const ratio = newScale / scale;

                // Adjust pan so the point under the cursor stays fixed
                posX -= cx * (ratio - 1);
                posY -= cy * (ratio - 1);

                scale = newScale;
                clampPan();
                applyTransform();
            }

            function imageOverflowsViewport() {
                const c = container.getBoundingClientRect();
                const iw = viewerImg.naturalWidth * scale;
                const ih = viewerImg.naturalHeight * scale;

                return iw > c.width + 1 || ih > c.height + 1;
            }

})();
