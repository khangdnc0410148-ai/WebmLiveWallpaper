
(function VideoBackground() {
"use strict";

// ==============================
// CONFIG
// ==============================

const ID = "vb2";
const DB_NAME = "SpotifyVideoBackgroundV2";
const STORE_NAME = "files";

const defaults = {
    enabled: true,
    opacity: 55,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    speed: 1,
    zoom: 100,
    posX: 0,
    posY: 0,
    fit: "cover",
    topOpacity: 0,
    rightOpacity: 0,
    leftOpacity: 0,
    bottomOpacity: 35,
    uiBlur: 5,
    hideMain: false,

    artworkX: 0,
    artworkY: 0,
    artworkRadius: 16,
    artworkSize: 100,
    artworkSpeed: 6
};

let settings = { ...defaults };
let db, video, objectUrl, fileInput;
let panel, statusText, toggle, guiToggle, buttonContainer, observer;

// ==============================
// SLIDER CONFIG
// ==============================

const sliders = [
    { id: "opacity", name: "Video Opacity", min: 0, max: 100, unit: "%" },
    { id: "brightness", name: "Brightness", min: 0, max: 200, unit: "%" },
    { id: "contrast", name: "Contrast", min: 0, max: 200, unit: "%" },
    { id: "saturation", name: "Saturation", min: 0, max: 200, unit: "%" },
    { id: "blur", name: "Video Blur", min: 0, max: 30, unit: "px" },
    { id: "speed", name: "Playback Speed", min: 25, max: 200, unit: "x", multiply: 100 },
    { id: "zoom", name: "Video Zoom", min: 50, max: 200, unit: "%" },
    { id: "posX", name: "Position X", min: -50, max: 50, unit: "%" },
    { id: "posY", name: "Position Y", min: -50, max: 50, unit: "%" },
    { id: "topOpacity", name: "Top Bar Transparency", min: 0, max: 100, unit: "%" },
    { id: "rightOpacity", name: "Right Sidebar Transparency", min: 0, max: 100, unit: "%" },
    { id: "leftOpacity", name: "Left Sidebar Transparency", min: 0, max: 100, unit: "%" },
    { id: "bottomOpacity", name: "Bottom Player Transparency", min: 0, max: 100, unit: "%" },
    { id: "uiBlur", name: "Interface Blur", min: 0, max: 30, unit: "px" }
];

const artworkSliders = [
    { id: "artworkX", name: "Artwork Position X", min: -1500, max: 1500, unit: "px" },
    { id: "artworkY", name: "Artwork Position Y", min: -500, max: 500, unit: "px" },
    { id: "artworkRadius", name: "Artwork Roundness", min: 0, max: 50, unit: "%" },
    { id: "artworkSize", name: "Artwork Size", min: 50, max: 150, unit: "%" },
    { id: "artworkSpeed", name: "Artwork Spin Speed", min: 0, max: 60, unit: "s/round" }
];

// ==============================
// SETTINGS
// ==============================

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(ID + ":settings"));
        if (saved) settings = { ...defaults, ...saved };
    } catch (e) {
        console.warn("[VB2] Settings:", e);
    }
}

function saveSettings() {
    try {
        localStorage.setItem(ID + ":settings", JSON.stringify(settings));
    } catch (e) {
        console.warn("[VB2] Cannot save settings:", e);
    }
}

// ==============================
// INDEXED DB
// ==============================

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveHandle(handle) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(handle, "background");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

function getHandle() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get("background");

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
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

// ==============================
// VIDEO
// ==============================

function setStatus(message) {
    if (statusText) statusText.textContent = message;
}

function createVideo(file) {
    if (!file || !file.type.startsWith("video/")) {
        setStatus("Invalid video file!");
        return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);

    objectUrl = URL.createObjectURL(file);

    if (!video) {
        video = document.createElement("video");
        video.id = "vb2-video";

        Object.assign(video, {
            autoplay: true,
            loop: true,
            muted: true,
            playsInline: true,
            preload: "auto"
        });

        Object.assign(video.style, {
            position: "fixed",
            inset: "0",
            width: "100vw",
            height: "100vh",
            zIndex: "0",
            pointerEvents: "none",
            objectFit: "cover",
            background: "#000",
            transformOrigin: "center center"
        });

        document.body.prepend(video);
    }

    video.src = objectUrl;
    video.load();

    video.play().then(() => {
        setStatus("Playing: " + file.name);
        updatePlayButton();
    }).catch(e => {
        console.warn("[VB2] Playback:", e);
        setStatus("Playback failed. Check video codec.");
    });

    applySettings();
}

async function chooseVideo() {
    if (window.showOpenFilePicker) {
        try {
            const [handle] = await window.showOpenFilePicker({
                multiple: false,
                types: [{
                    description: "Video files",
                    accept: {
                        "video/mp4": [".mp4"],
                        "video/webm": [".webm"]
                    }
                }]
            });

            await saveHandle(handle);
            createVideo(await handle.getFile());
            return;

        } catch (e) {
            if (e.name === "AbortError") return;
            console.warn("[VB2] File picker:", e);
        }
    }

    fileInput.click();
}

async function restoreVideo(requestPermission = false) {
    try {
        const handle = await getHandle();

        if (!handle) {
            setStatus("No saved video.");
            return;
        }

        let permission = await handle.queryPermission({ mode: "read" });

        if (permission !== "granted" && requestPermission) {
            permission = await handle.requestPermission({ mode: "read" });
        }

        if (permission !== "granted") {
            setStatus("File permission required. Click RESTORE VIDEO.");
            return;
        }

        createVideo(await handle.getFile());

    } catch (e) {
        console.warn("[VB2] Restore:", e);
        setStatus("Cannot restore video. Select it again.");
    }
}

function deleteVideo() {
    if (video) {
        video.pause();
        video.remove();
        video = null;
    }

    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
    }

    removeHandle().catch(e => console.warn("[VB2] Delete:", e));
    setStatus("Video removed.");
    updatePlayButton();
}

// ==============================
// ARTWORK ROTATION
// ==============================

function isSpotifyPlaying() {
    try {
        const player = Spicetify.Player;

        if (typeof player.isPlaying === "function") {
            return player.isPlaying();
        }

        if (player.data && typeof player.data.isPaused === "boolean") {
            return !player.data.isPaused;
        }
    } catch (e) {
        console.warn("[VB2] Player state:", e);
    }

    return false;
}

function updateArtworkSpin() {
    const artwork = document.querySelector(
        ".Root__cinema-view .dqhQxcx8LVpxQ9OTST61"
    );

    if (!artwork) return;

    const speed = settings.artworkSpeed;
    const spinning = speed > 0;

    artwork.classList.toggle("vb2-spinning", spinning);

    if (spinning) {
        artwork.style.setProperty("--vb2-artwork-duration", speed + "s");
        artwork.style.animationPlayState =
            isSpotifyPlaying() ? "running" : "paused";
    }
}

// ==============================
// APPLY SETTINGS
// ==============================

function applySettings() {
    if (video) {
        video.style.opacity = settings.enabled
            ? String(settings.opacity / 100)
            : "0";

        video.style.filter = `
            blur(${settings.blur}px)
            brightness(${settings.brightness}%)
            contrast(${settings.contrast}%)
            saturate(${settings.saturation}%)
        `;

        video.style.objectFit = settings.fit;
        video.playbackRate = settings.speed;

        video.style.transform = `
            translate(${settings.posX}%, ${settings.posY}%)
            scale(${settings.zoom / 100})
        `;
    }

    const root = document.documentElement;

    root.style.setProperty("--vb2-top-alpha", settings.topOpacity / 100);
    root.style.setProperty("--vb2-right-alpha", settings.rightOpacity / 100);
    root.style.setProperty("--vb2-left-alpha", settings.leftOpacity / 100);
    root.style.setProperty("--vb2-bottom-alpha", settings.bottomOpacity / 100);
    root.style.setProperty("--vb2-ui-blur", settings.uiBlur + "px");

    root.style.setProperty("--vb2-artwork-x", settings.artworkX + "px");
    root.style.setProperty("--vb2-artwork-y", settings.artworkY + "px");
    root.style.setProperty("--vb2-artwork-radius", settings.artworkRadius + "%");
    root.style.setProperty("--vb2-artwork-size", settings.artworkSize / 100);

    updateArtworkSpin();
}

// ==============================
// HIDE MAIN GUI
// ==============================

function applyMainVisibility() {
    document.body.classList.toggle("vb2-hide-main", settings.hideMain);

    if (guiToggle) {
        guiToggle.textContent = settings.hideMain ? "SHOW GUI" : "HIDE GUI";
    }
}

// ==============================
// NAVIGATION BUTTONS
// ==============================

function placeButtons() {
    const history = document.querySelector(".main-globalNav-historyButtons");

    if (!history || !buttonContainer) return;

    if (buttonContainer.parentElement !== history) {
        history.appendChild(buttonContainer);
    }
}

// ==============================
// SLIDERS
// ==============================

function createSliderHTML(item) {
    return `
        <div class="vb2-row">
            <span>${item.name}</span>
            <span id="vb2-${item.id}-value"></span>
        </div>
        <input type="range"
            id="vb2-${item.id}"
            min="${item.min}"
            max="${item.max}"
            step="1">
    `;
}

function getSliderValue(item) {
    return item.multiply
        ? settings[item.id] * item.multiply
        : settings[item.id];
}

function formatSliderValue(item) {
    const value = settings[item.id];

    if (item.id === "speed") {
        return value.toFixed(2) + "x";
    }

    if (item.id === "artworkSpeed") {
        return value === 0 ? "Off" : value + "s/round";
    }

    return value + item.unit;
}

function updateControls() {
    if (!panel) return;

    sliders.forEach(item => {
        const input = document.getElementById("vb2-" + item.id);
        const output = document.getElementById("vb2-" + item.id + "-value");

        if (!input || !output) return;

        input.value = getSliderValue(item);
        output.textContent = formatSliderValue(item);
    });

    artworkSliders.forEach(item => {
        const input = document.getElementById("vb2-" + item.id);
        const output = document.getElementById("vb2-" + item.id + "-value");

        if (!input || !output) return;

        input.value = settings[item.id];
        output.textContent = formatSliderValue(item);
    });

    document.getElementById("vb2-enabled").checked = settings.enabled;
    document.getElementById("vb2-fit").value = settings.fit;

    updatePlayButton();
}

function updatePlayButton() {
    const button = document.getElementById("vb2-play");

    if (button) {
        button.textContent = video && !video.paused ? "PAUSE" : "PLAY";
    }

    updateArtworkSpin();
}

// ==============================
// CSS
// ==============================

function createCSS() {
    document.getElementById("vb2-style")?.remove();

    const style = document.createElement("style");
    style.id = "vb2-style";

    style.textContent = `

    /* VIDEO */

    #vb2-video {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 0 !important;
        pointer-events: none !important;
    }

    /* MAIN BACKGROUND */

    #main,
    .Root__main-view,
    .Root__top-container,
    .main-view-container,
    .main-view-container__scroll-node,
    .main-view-container__scroll-node-child {
        background-color: transparent !important;
        background-image: none !important;
    }

    /* LEFT SIDEBAR */

    #Desktop_LeftSidebar_Id,
    .Root__nav-bar {
        background: rgba(18,18,18,var(--vb2-left-alpha,0)) !important;
        background-color: rgba(18,18,18,var(--vb2-left-alpha,0)) !important;
        backdrop-filter: blur(var(--vb2-ui-blur,5px)) !important;
        -webkit-backdrop-filter: blur(var(--vb2-ui-blur,5px)) !important;
    }

    .Root__nav-bar > nav,
    .Root__nav-bar .main-navBar-mainNav,
    .Root__nav-bar .main-yourLibraryX-entryPoints,
    .Root__nav-bar .main-yourLibraryX-libraryContainer {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
    }

    /* RIGHT SIDEBAR */

    .Root__right-sidebar,
    .Root__right-sidebar > div,
    #Desktop_PanelContainer_Id {
        background: rgba(18,18,18,var(--vb2-right-alpha,0)) !important;
        background-color: rgba(18,18,18,var(--vb2-right-alpha,0)) !important;
        background-image: none !important;

        --background-base: rgba(18,18,18,var(--vb2-right-alpha,0)) !important;
        --background-tinted-base: rgba(18,18,18,var(--vb2-right-alpha,0)) !important;
        --section-background: rgba(18,18,18,var(--vb2-right-alpha,0)) !important;
        --section-background-base: rgba(18,18,18,var(--vb2-right-alpha,0)) !important;

        backdrop-filter: blur(var(--vb2-ui-blur,5px)) !important;
        -webkit-backdrop-filter: blur(var(--vb2-ui-blur,5px)) !important;
    }

    #Desktop_PanelContainer_Id > *,
    #Desktop_PanelContainer_Id .main-nowPlayingView-mainContainer,
    #Desktop_PanelContainer_Id .main-nowPlayingView-mainWrapper,
    #Desktop_PanelContainer_Id .main-nowPlayingView-panel,
    #Desktop_PanelContainer_Id .main-nowPlayingView-nowPlayingWidget,
    #Desktop_PanelContainer_Id .main-nowPlayingView-section {
        background-color: transparent !important;
        background-image: none !important;
    }

    .Root__right-sidebar .main-nowPlayingView-contextItemInfo::before {
        content: none !important;
        display: none !important;
    }

    /* TOP BAR */

    .Root__top-container,
    .main-topBar-container,
    .main-topBar-topbarContent,
    .main-topBar-topbarContentWrapper,
    .main-globalNav,
    .main-globalNav-container {
        background: rgba(18,18,18,var(--vb2-top-alpha,0)) !important;
        background-image: none !important;
    }

    /* HOME HEADER */

    .main-home-homeHeader,
    .main-home-homeHeaderBackground,
    .main-home-homeHeaderContent,
    .main-home-homeHeaderContainer {
        background: rgba(18,18,18,var(--vb2-top-alpha,0)) !important;
        background-image: none !important;
    }

    /* BOTTOM PLAYER */

    .Root__now-playing-bar {
        background: rgba(18,18,18,var(--vb2-bottom-alpha,.35)) !important;
        backdrop-filter: blur(var(--vb2-ui-blur,5px)) !important;
        -webkit-backdrop-filter: blur(var(--vb2-ui-blur,5px)) !important;
    }

    /* HIDE MAIN GUI */

    body.vb2-hide-main .Root__main-view,
    body.vb2-hide-main .main-view-container {
        visibility: hidden !important;
        pointer-events: none !important;
    }

    /* NAVIGATION BUTTON CONTAINER */

    #vb2-button-container {
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: 8px;
        pointer-events: auto;
        z-index: 10;
        transform: none;
        -webkit-app-region: no-drag;
    }

    #vb2-toggle,
    #vb2-gui-toggle {
        position: relative !important;
        z-index: 2147483647 !important;
        flex: 0 0 auto !important;
        width: auto !important;
        min-width: 75px !important;
        height: 30px !important;
        margin: 0 !important;
        padding: 0 12px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: none !important;
        border-radius: 20px !important;
        font-size: 11px !important;
        font-weight: bold !important;
        white-space: nowrap !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        -webkit-app-region: no-drag !important;
    }

    #vb2-toggle {
        background: #1ed760 !important;
        color: #111 !important;
    }

    #vb2-gui-toggle {
        background: #282828 !important;
        color: white !important;
    }

    #vb2-toggle:hover {
        background: #3be477 !important;
    }

    #vb2-gui-toggle:hover {
        background: #444 !important;
    }

    /* SETTINGS PANEL */

    #vb2-panel {
        position: fixed;
        top: 65px;
        right: 20px;
        width: 320px;
        max-height: 80vh;
        padding: 18px;
        z-index: 2147483647;
        overflow-y: auto;
        color: white;
        background: rgba(18,18,18,.96);
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

    #vb2-panel h4 {
        margin: 20px 0 10px;
        font-size: 13px;
        color: #1ed760;
    }

    #vb2-panel button {
        border: none;
        border-radius: 8px;
        padding: 10px;
        cursor: pointer;
        color: white;
        background: #282828;
    }

    #vb2-panel button:hover {
        background: #444;
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

    #vb2-panel .vb2-row span:last-child {
        color: #1ed760;
    }

    #vb2-panel input[type=range] {
        width: 100%;
        accent-color: #1ed760;
        cursor: pointer;
    }

    #vb2-panel input[type=checkbox] {
        accent-color: #1ed760;
    }

    #vb2-panel select {
        color: white;
        background: #282828;
        padding: 7px;
        border: none;
        border-radius: 6px;
    }

    #vb2-panel hr {
        border: 0;
        border-top: 1px solid #444;
        margin: 18px 0;
    }

    #vb2-status {
        margin-top: 12px;
        color: #aaa;
        overflow-wrap: anywhere;
        font-size: 11px;
    }

    /* ARTWORK CUSTOMIZATION */

    .Root__cinema-view .Ylv1JwmqfJELAxNS7vJ0 {
        transform:
            translate(
                var(--vb2-artwork-x, 0px),
                var(--vb2-artwork-y, 0px)
            )
            scale(var(--vb2-artwork-size, 1)) !important;

        transform-origin: center center !important;
        border-radius: var(--vb2-artwork-radius, 16%) !important;
        overflow: hidden !important;
    }

    .Root__cinema-view .dqhQxcx8LVpxQ9OTST61 {
        border-radius: var(--vb2-artwork-radius, 16%) !important;
    }

    /* VINYL ROTATION */

    .Root__cinema-view .dqhQxcx8LVpxQ9OTST61.vb2-spinning {
        animation: vb2-artwork-spin var(--vb2-artwork-duration, 6s) linear infinite;
        animation-play-state: paused;
        transform-origin: center center;
        will-change: transform;
    }

    @keyframes vb2-artwork-spin {
        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(360deg);
        }
    }

    /* FULLSCREEN CINEMA TRANSPARENCY */

    .Root__cinema-view,
    .Root__cinema-view > div {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
    }

    .Root__cinema-view .RSOVjwDmB9S4xPy2hC4K {
        --cinema-mode-bg-color-from: transparent !important;
        --cinema-mode-bg-color-to: transparent !important;
        --background-base: transparent !important;
        --background-elevated-base: transparent !important;

        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
    }

    .Root__cinema-view .x0lJCeJrx_56dJTWdATl,
    .Root__cinema-view .yaQHwh0l4jAotP10cXo5 {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
    }

    `;

    document.head.appendChild(style);
}

// ==============================
// CREATE INTERFACE
// ==============================

function createInterface() {
    createCSS();

    // Tạo hai nút
    toggle = document.createElement("button");
    toggle.id = "vb2-toggle";
    toggle.type = "button";
    toggle.textContent = "VIDEO BG";

    toggle.onclick = () => {
        panel.style.display =
            panel.style.display === "none" ? "block" : "none";
    };

    guiToggle = document.createElement("button");
    guiToggle.id = "vb2-gui-toggle";
    guiToggle.type = "button";

    guiToggle.onclick = () => {
        settings.hideMain = !settings.hideMain;
        saveSettings();
        applyMainVisibility();
    };

    // Đặt nút vào thanh điều hướng
    buttonContainer = document.createElement("div");
    buttonContainer.id = "vb2-button-container";
    buttonContainer.append(toggle, guiToggle);
    document.body.appendChild(buttonContainer);

    // Chọn video
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".mp4,.webm,video/mp4,video/webm";
    fileInput.style.display = "none";

    fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (file) createVideo(file);
        fileInput.value = "";
    };

    document.body.appendChild(fileInput);

    // Settings panel
    panel = document.createElement("div");
    panel.id = "vb2-panel";

    panel.innerHTML = `
        <h3>VIDEO BACKGROUND</h3>

        <button class="vb2-primary" id="vb2-choose">CHOOSE VIDEO</button>
        <button style="width:100%" id="vb2-restore">RESTORE SAVED VIDEO</button>

        <div class="vb2-row">
            <span>Enable Background</span>
            <input type="checkbox" id="vb2-enabled">
        </div>

        <h4>VIDEO SETTINGS</h4>

        ${sliders.slice(0, 9).map(createSliderHTML).join("")}

        <div class="vb2-row">
            <span>Video Fit</span>
            <select id="vb2-fit">
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
            </select>
        </div>

        <hr>

        <h4>ARTWORK SETTINGS</h4>

        ${artworkSliders.map(createSliderHTML).join("")}

        <hr>

        <h4>INTERFACE SETTINGS</h4>

        ${sliders.slice(9).map(createSliderHTML).join("")}

        <hr>

        <h4>PLAYBACK</h4>

        <div class="vb2-row">
            <button id="vb2-play">PLAY</button>
            <button id="vb2-reset">RESET</button>
            <button id="vb2-delete">DELETE</button>
        </div>

        <div id="vb2-status">No video selected.</div>
    `;

    document.body.appendChild(panel);

    statusText = document.getElementById("vb2-status");

    document.getElementById("vb2-choose").onclick = chooseVideo;
    document.getElementById("vb2-restore").onclick = () => restoreVideo(true);

    document.getElementById("vb2-enabled").onchange = e => {
        settings.enabled = e.target.checked;
        saveSettings();
        applySettings();
    };

    sliders.forEach(item => {
        const input = document.getElementById("vb2-" + item.id);
        const output = document.getElementById("vb2-" + item.id + "-value");

        input.oninput = () => {
            settings[item.id] = item.multiply
                ? Number(input.value) / item.multiply
                : Number(input.value);

            output.textContent = formatSliderValue(item);
            saveSettings();
            applySettings();
        };
    });

    artworkSliders.forEach(item => {
        const input = document.getElementById("vb2-" + item.id);
        const output = document.getElementById("vb2-" + item.id + "-value");

        input.oninput = () => {
            settings[item.id] = Number(input.value);

            output.textContent = formatSliderValue(item);
            saveSettings();
            applySettings();
        };
    });

    document.getElementById("vb2-fit").onchange = e => {
        settings.fit = e.target.value;
        saveSettings();
        applySettings();
    };

    document.getElementById("vb2-play").onclick = () => {
        if (!video) return;

        if (video.paused) {
            video.play().then(updatePlayButton).catch(e => {
                console.warn("[VB2] Play:", e);
            });
        } else {
            video.pause();
            updatePlayButton();
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
        applyMainVisibility();
    };

    document.getElementById("vb2-delete").onclick = deleteVideo;

    updateControls();
    placeButtons();
    applySettings();
    applyMainVisibility();

    // Theo dõi thay đổi giao diện Spotify
    observer = new MutationObserver(() => {
        placeButtons();
        updateArtworkSpin();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    window.addEventListener("resize", placeButtons);

    // Theo dõi trạng thái phát nhạc Spotify
    if (Spicetify.Player?.addEventListener) {
        Spicetify.Player.addEventListener("onplaypause", updateArtworkSpin);
        Spicetify.Player.addEventListener("songchange", updateArtworkSpin);
    }
}

// ==============================
// INITIALIZATION
// ==============================

async function init() {
    loadSettings();
    db = await openDB();

    createInterface();

    await restoreVideo();

    applySettings();
    applyMainVisibility();
    placeButtons();
    updateArtworkSpin();

    console.log("[VB2] Video Background loaded.");
}

init().catch(e => {
    console.error("[VB2] Initialization:", e);

    if (window.Spicetify?.showNotification) {
        Spicetify.showNotification("Video Background failed to initialize!");
    }
});

})();
