// Stream Dock Plugin - Mac Shortcuts
// Based on Stream Dock SDK template

let websocket = null;
let uuid = null;
let actionInfo = null;
let settings = {};

// Data from backend
let listOfCuts = ['Loading...'];
let shortcutsFolder = ['All'];
let mappedDataFromBackend = {};
let listOfVoices = ['Alex']; // Kept for compatibility
let isSayvoice = false; // Accessibility OFF by default
let isForcedTitle = false;
let globalSayVoice = "Alex"; // Default value
let usersSelectedShortcut = "";

// Store translations globally for dynamic updates
let globalTranslations = {};

// Removed debug function

// Stream Dock WebSocket connection function
async function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inPluginUUID;
    actionInfo = JSON.parse(inActionInfo);

    // Create WebSocket connection
    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    websocket.onopen = function() {
        // Register Property Inspector
        const json = {
            event: inRegisterEvent,
            uuid: inPluginUUID
        };

        websocket.send(JSON.stringify(json));

        // Request settings from backend
        requestSettings();

        // Show the main wrapper
        const mainWrapper = document.getElementById('mainWrapper');
        if (mainWrapper) {
            mainWrapper.classList.remove('hidden');
        }
    };

    websocket.onmessage = function(evt) {
        const jsonObj = JSON.parse(evt.data);

        if (jsonObj.event === 'sendToPropertyInspector') {
            handleBackendResponse(jsonObj.payload);
        }
    };

    websocket.onerror = function(evt) {
        console.error('WebSocket error:', evt);
    };

    websocket.onclose = function(evt) {
        console.warn('WebSocket closed:', evt.code);
    };

    // Auto translate page
    try {
        const appInfo = JSON.parse(inInfo);
        const language = appInfo.application.language || 'en';
        
        // Load translations
        const translations = await new Promise(resolve => {
            const req = new XMLHttpRequest();
            req.open('GET', `../${language}.json`);
            req.send();
            req.onreadystatechange = () => {
                if (req.readyState === 4) {
                    if (req.status === 200) {
                        resolve(JSON.parse(req.responseText).Localization);
                    } else {
                        // Fallback to English if language file not found
                        const fallbackReq = new XMLHttpRequest();
                        fallbackReq.open('GET', '../en.json');
                        fallbackReq.send();
                        fallbackReq.onreadystatechange = () => {
                            if (fallbackReq.readyState === 4 && fallbackReq.status === 200) {
                                resolve(JSON.parse(fallbackReq.responseText).Localization);
                            } else {
                                resolve({});
                            }
                        };
                    }
                }
            };
        });

        // Store translations globally and apply them
        if (translations) {
            globalTranslations = translations;
            
            // Traverse text nodes and translate all text nodes
            const mainWrapper = document.getElementById('mainWrapper');
            if (mainWrapper) {
                const walker = document.createTreeWalker(mainWrapper, NodeFilter.SHOW_TEXT, (node) => {
                    return node.data.trim() && NodeFilter.FILTER_ACCEPT;
                });
                
                while (walker.nextNode()) {
                    const originalText = walker.currentNode.data.trim();
                    if (translations[originalText]) {
                        walker.currentNode.data = translations[originalText];
                    }
                }

                // Special handling for placeholder attributes
                const translatePlaceholders = item => {
                    if (item.placeholder?.trim() && translations[item.placeholder.trim()]) {
                        item.placeholder = translations[item.placeholder.trim()];
                    }
                };
                
                mainWrapper.querySelectorAll('input').forEach(translatePlaceholders);
                mainWrapper.querySelectorAll('textarea').forEach(translatePlaceholders);
            }
        }
    } catch (error) {
        console.warn('Translation failed:', error);
    }
}

// Send message to plugin
function sendToPlugin(payload) {
    if (websocket) {
        const json = {
            action: actionInfo.action,
            event: 'sendToPlugin',
            context: uuid,
            payload: payload
        };
        websocket.send(JSON.stringify(json));
    }
}

// Request settings from backend
function requestSettings() {
    sendToPlugin({
        type: "requestSettings"
    });
}

// Handle response from backend
function handleBackendResponse(payload) {
    try {
        if (payload.error) {
            console.error('Backend error:', payload.error);
            return;
        }

        // Parse data from backend
        usersSelectedShortcut = payload.shortcutName || "";
        globalSayVoice = payload.sayvoice || "Alex";
        isSayvoice = parseJSONSafely(payload.isSayvoice) || false;
        isForcedTitle = parseJSONSafely(payload.isForcedTitle) || false;

        // Parse shortcuts data
        shortcutsFolder = parseJSONSafely(payload.shortcutsFolder);
        if (!Array.isArray(shortcutsFolder)) {
            shortcutsFolder = ['All'];
        }

        mappedDataFromBackend = parseJSONSafely(payload.mappedDataFromBackend);
        if (!mappedDataFromBackend || typeof mappedDataFromBackend !== 'object') {
            mappedDataFromBackend = { 'Default Shortcut': 'All' };
        }

        listOfVoices = parseJSONSafely(payload.voices);
        if (!Array.isArray(listOfVoices)) {
            listOfVoices = ['Alex', 'Samantha'];
        }

        // Update UI
        filterMapped('All');
        refreshListOfShortcutsFolders();
        refreshListOfShortcuts();
        setForcedTitleState();

        // Show the main interface
        const PI_Shortcuts = document.getElementById('PI_Shortcuts');
        if (PI_Shortcuts) {
            PI_Shortcuts.style.display = "block";
        }

    } catch (error) {
        console.error('Error processing response:', error.message);
    }
}

// Update settings
function updateSettings() {
    if (!uuid) return;

    let payload = {
        type: "updateSettings"
    };

    const shortcutName = document.getElementById('shortcut_list');
    if (shortcutName) {
        payload.shortcutName = shortcutName.value;
    }

    payload.isForcedTitle = isForcedTitle.toString();

    // Fixed accessibility values (OFF)
    payload.sayvoice = "Alex";
    payload.isSayvoice = "false";
    payload.sayHoldTime = "0";

    sendToPlugin(payload);
}

// Helper function to parse JSON safely
function parseJSONSafely(str) {
    try {
        if (typeof str === 'string') {
            return JSON.parse(str);
        }
        return str;
    } catch (error) {
        console.error('JSON parse error:', error.message);
        return {};
    }
}

// All the existing UI functions (keeping the same logic)
function filterMapped(filteredByFolder) {
    listOfCuts.length = 0;

    if (filteredByFolder == 'All') {
        for (var key in mappedDataFromBackend) {
            listOfCuts.push(key);
        }
    } else {
        for (var key in mappedDataFromBackend) {
            if (filteredByFolder == mappedDataFromBackend[key]) {
                listOfCuts.push(key);
            }
        }
    }

    const select = document.getElementById("shortcuts_folder_list");
    if (select) select.value = filteredByFolder;

    listOfCuts.sort();
    refreshListOfShortcuts();
}

function refreshListOfShortcutsFolders() {
    const select = document.getElementById("shortcuts_folder_list");
    if (!select) return;

    if (shortcutsFolder.length <= 1) {
        const folderID = document.getElementById("isFolder");
        if (folderID) folderID.style.display = "none";
    }

    if (select.length != shortcutsFolder.length) {
        select.length = 0;
        for (var val of shortcutsFolder) {
            const option = document.createElement("option");
            option.value = val;
            option.text = val;
            select.appendChild(option);
        }
    }
}

function refreshListOfShortcuts() {
    const listOfShortcuts = document.getElementById("shortcut_list");
    if (!listOfShortcuts) return;

    listOfShortcuts.length = 0;

    for (var val of listOfCuts) {
        const option = document.createElement("option");
        option.value = val;
        
        // Translate "Loading..." if it's the placeholder
        if (val === 'Loading...' && globalTranslations['Loading...']) {
            option.text = globalTranslations['Loading...'];
        } else {
            option.text = val.charAt(0).toUpperCase() + val.slice(1);
        }
        
        listOfShortcuts.appendChild(option);
    }

    if (listOfCuts.includes(usersSelectedShortcut)) {
        listOfShortcuts.value = usersSelectedShortcut;
    }
}

function setForcedTitleState() {
    const button = document.getElementById("forced_title_checkbox");
    if (!button) return;

    // Use translations if available, fallback to English
    const onText = globalTranslations['ON'] || 'ON';
    const offText = globalTranslations['OFF'] || 'OFF';
    
    button.textContent = isForcedTitle ? onText : offText;
}

function selectedNewIndex(selected_id, selected_type) {
    if (selected_type == "shortcutFolder") {
        filterMapped(shortcutsFolder[selected_id]);
    } else if (selected_type == "shortcut") {
        // Shortcut selected
    }
    updateSettings();
}

function changeForcedTitle() {
    isForcedTitle = !isForcedTitle;
    setForcedTitleState();
    updateSettings();
}
