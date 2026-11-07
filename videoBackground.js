
(function VideoBackground() {
    "use strict";

    const ID = "vb2";
    const DB_NAME = "SpotifyVideoBackgroundV2";
    const STORE_NAME = "files";

    const defaults = {
        enabled: true,
        opacity: 55,
        blur: 0,
        brightness: 100,
        fit: "cover",
        hideMain: false
    };

    let settings = { ...defaults };
    let db = null;
    let video = null;
    let objectUrl = null;
    let fileInput = null;
    let panel = null;
    let statusText = null;
    let toggle = null;
    let guiToggle = null;
    let observer = null;
    let placementFrame = 0;

    function loadSettings() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(ID + ":settings")
            );

            if (saved) {
                settings = { ...defaults, ...saved };
            }
        } catch (e) {
            console.warn("[VB2] Settings:", e);
        }
    }

    function saveSettings() {
        localStorage.setItem(
            ID + ":settings",
            JSON.stringify(settings)
        );
    }

    function openDB() {
        return new Promise((resolve, reject) => {
            const r = indexedDB.open(DB_NAME, 1);

            r.onupgradeneeded = () => {
                if (!r.result.objectStoreNames.contains(STORE_NAME)) {
                    r.result.createObjectStore(STORE_NAME);
                }
            };

            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    }

    function saveHandle(h) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");

            tx.objectStore(STORE_NAME).put(h, "background");

            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    function getHandle() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const r = tx.objectStore(STORE_NAME).get("background");

            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    }

    function removeHandle() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");

            tx.objectStore(STORE_NAME).delete("background");

            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    function setStatus(s) {
        if (statusText) {
            statusText.textContent = s;
        }
    }

    function applySettings() {
        if (!video) return;

        video.style.opacity = settings.enabled
            ? String(settings.opacity / 100)
            : "0";

        const needsFilter =
            settings.blur > 0 ||
            settings.brightness !== 100;

        video.style.filter = needsFilter
            ? `blur(${settings.blur}px) brightness(${settings.brightness}%)`
            : "none";

        video.style.objectFit = settings.fit;
    }

    function updateGuiButton() {
        if (guiToggle) {
            guiToggle.textContent = settings.hideMain
                ? "SHOW GUI"
                : "HIDE GUI";
        }
    }

    function applyMainVisibility() {
        document.body.classList.toggle(
            "vb2-hide-main",
            !!settings.hideMain
        );

        updateGuiButton();
    }

    function createVideo(file) {
        if (!file || !file.type.startsWith("video/")) {
            setStatus("File không hợp lệ.");
            return;
        }

        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }

        objectUrl = URL.createObjectURL(file);

        if (!video) {
            video = document.createElement("video");

            video.id = "vb2-video";
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = "auto";

            Object.assign(video.style, {
                position: "fixed",
                inset: "0",
                width: "100vw",
                height: "100vh",
                zIndex: "0",
                pointerEvents: "none",
                objectFit: "cover",
                transition: "opacity .25s ease",
                transform: "translate3d(0, 0, 0)",
                backfaceVisibility: "hidden",
                willChange: "opacity",
                background: "#000"
            });

            document.body.prepend(video);
        }

        video.src = objectUrl;
        video.load();

        video.play().then(() => {
            setStatus(file.name);
        }).catch(e => {
            console.warn("[VB2] Playback:", e);
            setStatus("Không phát được video. Kiểm tra codec.");
        });

        applySettings();
    }

    async function chooseVideo() {
        if (window.showOpenFilePicker) {
            try {
                const [h] = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{
                        description: "Video",
                        accept: {
                            "video/webm": [".webm"]
                        }
                    }]
                });

                await saveHandle(h);
                createVideo(await h.getFile());
                return;

            } catch (e) {
                if (e.name === "AbortError") return;
                console.warn("[VB2] Picker:", e);
            }
        }

        fileInput.click();
    }

    async function restoreVideo() {
        try {
            const h = await getHandle();

            if (!h) {
                setStatus("Chưa lưu video nào.");
                return;
            }

            let p = await h.queryPermission({
                mode: "read"
            });

            if (p !== "granted") {
                p = await h.requestPermission({
                    mode: "read"
                });
            }

            if (p !== "granted") {
                setStatus(
                    "Chưa được cấp quyền đọc file. Hãy chọn lại video."
                );
                return;
            }

            createVideo(await h.getFile());

        } catch (e) {
            console.warn("[VB2] Restore:", e);
            setStatus("Không thể khôi phục video. Hãy chọn lại file.");
        }
    }

    function findNavigation() {
        const selectors = [
            ".main-globalNav-historyButtons",
            ".main-topBar-historyButtons",
            ".main-globalNav",
            "#global-nav-bar > div:first-of-type"
        ];

        for (const s of selectors) {
            const n = document.querySelector(s);
            if (n) return n;
        }

        return null;
    }

    function placeButtons() {
        if (!toggle || !guiToggle) return;

        const nav = findNavigation();

        if (nav) {
            if (toggle.parentElement !== nav) {
                nav.appendChild(toggle);
            }

            if (guiToggle.parentElement !== nav) {
                nav.appendChild(guiToggle);
            }
        } else {
            if (toggle.parentElement !== document.body) {
                document.body.appendChild(toggle);
            }

            if (guiToggle.parentElement !== document.body) {
                document.body.appendChild(guiToggle);
            }
        }
    }

    function schedulePlaceButtons() {
        if (placementFrame) return;

        placementFrame = requestAnimationFrame(() => {
            placementFrame = 0;
            placeButtons();
        });
    }

    function updateControls() {
        if (!panel) return;

        ["opacity", "blur", "brightness"].forEach(k => {
            const input = document.getElementById("vb2-" + k);
            const out = document.getElementById("vb2-" + k + "-value");

            input.value = settings[k];

            out.textContent = settings[k] +
                (k === "brightness"
                    ? "%"
                    : k === "blur" ? "px" : "%");
        });

        document.getElementById("vb2-enabled").checked =
            settings.enabled;

        document.getElementById("vb2-fit").value =
            settings.fit;
    }

    function createInterface() {
        if (document.getElementById("vb2-panel")) return;

        const style = document.createElement("style");
        style.id = "vb2-style";

        style.textContent = `
            html, body {
                background: transparent !important;
            }

            #vb2-video {
                position: fixed !important;
                inset: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                pointer-events: none !important;
                z-index: 0 !important;
            }

            #main,
            .Root__main-view,
            .Root__top-container,
            .Root__nav-bar,
            .Root__now-playing-bar,
            .Root__left-sidebar,
            .Root__global-nav,
            .main-view-container,
            .main-view-container__scroll-node,
            .main-view-container__scroll-node-child,
            .main-yourLibraryX-libraryRootlist,
            .main-yourLibraryX-libraryContainer,
            .main-yourLibraryX-libraryHeader,
            .main-yourLibraryX-libraryContent,
            .main-yourLibraryX-libraryRootlistWrapper,
            .main-yourLibraryX-library,
            .main-yourLibraryX-entryPoints {
                background-color: transparent !important;
                background-image: none !important;
            }

            .Root__left-sidebar {
                background: rgba(18,18,18,.42) !important;
                backdrop-filter: blur(5px) !important;
                -webkit-backdrop-filter: blur(5px) !important;
            }

            body.vb2-hide-main .Root__main-view,
            body.vb2-hide-main .main-view-container {
                visibility: hidden !important;
                pointer-events: none !important;
            }

            #vb2-toggle,
            #vb2-gui-toggle {
                position: relative !important;
                top: auto !important;
                right: auto !important;
                z-index: 999999 !important;
                flex-shrink: 0;
                margin-left: 7px;
                padding: 7px 12px;
                border: 0;
                border-radius: 20px;
                font-size: 11px;
                font-weight: bold;
                white-space: nowrap;
                cursor: pointer;
            }

            #vb2-toggle {
                background: #1ed760;
                color: #111;
            }

            #vb2-gui-toggle {
                background: #282828;
                color: white;
            }

            #vb2-panel {
                position: fixed;
                top: 65px;
                right: 20px;
                width: 290px;
                padding: 18px;
                z-index: 999999;
                color: white;
                background: rgba(18,18,18,.94);
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 14px;
                box-shadow: 0 10px 40px #0008;
                font-family: Arial, sans-serif;
                font-size: 13px;
                display: none;
                box-sizing: border-box;
            }

            #vb2-panel * {
                box-sizing: border-box;
            }

            #vb2-panel h3 {
                margin: 0 0 15px;
                font-size: 17px;
            }

            #vb2-panel button {
                border: 0;
                border-radius: 8px;
                padding: 10px;
                cursor: pointer;
                color: white;
                background: #282828;
            }

            #vb2-panel button:hover {
                background: #3e3e3e;
            }

            #vb2-panel .vb2-primary {
                width: 100%;
                background: #1ed760;
                color: #111;
                font-weight: bold;
                margin-bottom: 8px;
            }

            #vb2-panel .vb2-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                margin: 15px 0 7px;
            }

            #vb2-panel input[type=range] {
                width: 100%;
                accent-color: #1ed760;
            }

            #vb2-panel select {
                color: white;
                background: #282828;
                padding: 7px;
                border: 0;
                border-radius: 6px;
            }

            #vb2-status {
                margin-top: 12px;
                color: #aaa;
                overflow-wrap: anywhere;
                font-size: 11px;
            }
        `;

        document.head.appendChild(style);

        toggle = document.createElement("button");
        toggle.id = "vb2-toggle";
        toggle.textContent = "VIDEO BG";

        toggle.onclick = () => {
            panel.style.display =
                panel.style.display === "none"
                    ? "block"
                    : "none";
        };

        guiToggle = document.createElement("button");
        guiToggle.id = "vb2-gui-toggle";

        guiToggle.onclick = () => {
            settings.hideMain = !settings.hideMain;
            saveSettings();
            applyMainVisibility();
        };

        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".webm,video/webm";
        fileInput.style.display = "none";

        fileInput.onchange = () => {
            const f = fileInput.files[0];

            if (f) createVideo(f);

            fileInput.value = "";
        };

        document.body.appendChild(fileInput);

        panel = document.createElement("div");
        panel.id = "vb2-panel";

        panel.innerHTML = `
            <h3>VIDEO BACKGROUND</h3>

            <button class="vb2-primary" id="vb2-choose">
                CHOOSE VIDEO
            </button>

            <button style="width:100%" id="vb2-restore">
                RESTORE SAVED VIDEO
            </button>

            <div class="vb2-row">
                <span>Enable background</span>
                <input type="checkbox" id="vb2-enabled">
            </div>

            <div class="vb2-row">
                <span>Opacity</span>
                <span id="vb2-opacity-value"></span>
            </div>
            <input type="range" id="vb2-opacity" min="0" max="100">

            <div class="vb2-row">
                <span>Blur</span>
                <span id="vb2-blur-value"></span>
            </div>
            <input type="range" id="vb2-blur" min="0" max="30">

            <div class="vb2-row">
                <span>Brightness</span>
                <span id="vb2-brightness-value"></span>
            </div>
            <input type="range" id="vb2-brightness" min="0" max="200">

            <div class="vb2-row">
                <span>Video fit</span>
                <select id="vb2-fit">
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="fill">Fill</option>
                </select>
            </div>

            <div class="vb2-row">
                <button id="vb2-play">Pause</button>
                <button id="vb2-reset">Reset settings</button>
                <button id="vb2-delete">Remove video</button>
            </div>

            <div id="vb2-status">Chưa chọn video</div>
        `;

        document.body.appendChild(panel);
        statusText = document.getElementById("vb2-status");

        document.getElementById("vb2-choose").onclick =
            chooseVideo;

        document.getElementById("vb2-restore").onclick =
            restoreVideo;

        document.getElementById("vb2-enabled").onchange = e => {
            settings.enabled = e.target.checked;
            saveSettings();
            applySettings();
        };

        ["opacity", "blur", "brightness"].forEach(k => {
            const input = document.getElementById("vb2-" + k);
            const out = document.getElementById("vb2-" + k + "-value");

            input.oninput = () => {
                settings[k] = Number(input.value);

                out.textContent = input.value +
                    (k === "brightness"
                        ? "%"
                        : k === "blur" ? "px" : "%");

                saveSettings();
                applySettings();
            };
        });

        document.getElementById("vb2-fit").onchange = e => {
            settings.fit = e.target.value;
            saveSettings();
            applySettings();
        };

        document.getElementById("vb2-play").onclick = e => {
            if (!video) return;

            if (video.paused) {
                video.play();
                e.target.textContent = "Pause";
            } else {
                video.pause();
                e.target.textContent = "Play";
            }
        };

        document.getElementById("vb2-reset").onclick = () => {
            settings = {
                ...defaults,
                hideMain: settings.hideMain
            };

            saveSettings();
            updateControls();
            applySettings();
        };

        document.getElementById("vb2-delete").onclick =
            async () => {
                if (video) {
                    video.pause();
                    video.remove();
                    video = null;
                }

                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                    objectUrl = null;
                }

                try {
                    await removeHandle();
                } catch (e) {
                    console.warn("[VB2] Delete handle:", e);
                }

                setStatus("Đã xóa video.");
            };

        updateControls();
        placeButtons();
        applyMainVisibility();

        if (observer) observer.disconnect();

        observer = new MutationObserver(schedulePlaceButtons);

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async function init() {
        loadSettings();
        db = await openDB();

        createInterface();

        await restoreVideo();

        applySettings();
        applyMainVisibility();
    }

    init().catch(e => {
        console.error("[VB2] Initialization:", e);

        if (window.Spicetify && Spicetify.showNotification) {
            Spicetify.showNotification(
                "Video Background: Không thể khởi tạo extension!"
            );
        }
    });

})();
