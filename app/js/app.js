const SELECTORS = {
    popup: "popup",
    popupTitle: "popupTitle",
    popupMessage: "popupMessage",
    loaderText: "loader-text"
};

// Common calling-code -> ISO 3166-1 alpha-2 map.
// Shared codes (e.g. +1, +7, +44) default to the most common country.
const DIALING_CODE_TO_ISO = {
    "1": "US", "7": "RU", "20": "EG", "27": "ZA", "30": "GR", "31": "NL",
    "32": "BE", "33": "FR", "34": "ES", "36": "HU", "39": "IT", "40": "RO",
    "41": "CH", "43": "AT", "44": "GB", "45": "DK", "46": "SE", "47": "NO",
    "48": "PL", "49": "DE", "51": "PE", "52": "MX", "53": "CU", "54": "AR",
    "55": "BR", "56": "CL", "57": "CO", "58": "VE", "60": "MY", "61": "AU",
    "62": "ID", "63": "PH", "64": "NZ", "65": "SG", "66": "TH", "81": "JP",
    "82": "KR", "84": "VN", "86": "CN", "90": "TR", "91": "IN", "92": "PK",
    "93": "AF", "94": "LK", "95": "MM", "98": "IR",
    "211": "SS", "212": "MA", "213": "DZ", "216": "TN", "218": "LY",
    "220": "GM", "221": "SN", "222": "MR", "223": "ML", "224": "GN",
    "225": "CI", "226": "BF", "227": "NE", "228": "TG", "229": "BJ",
    "230": "MU", "231": "LR", "232": "SL", "233": "GH", "234": "NG",
    "235": "TD", "236": "CF", "237": "CM", "238": "CV", "239": "ST",
    "240": "GQ", "241": "GA", "243": "CD", "244": "AO", "245": "GW",
    "248": "SC", "249": "SD", "250": "RW", "251": "ET", "252": "SO",
    "253": "DJ", "254": "KE", "255": "TZ", "256": "UG", "257": "BI",
    "258": "MZ", "260": "ZM", "261": "MG", "262": "RE", "263": "ZW",
    "264": "NA", "265": "MW", "266": "LS", "267": "BW", "268": "SZ",
    "269": "KM", "290": "SH", "291": "ER", "297": "AW", "298": "FO",
    "299": "GL",
    "350": "GI", "351": "PT", "352": "LU", "353": "IE", "354": "IS",
    "355": "AL", "356": "MT", "357": "CY", "358": "FI", "359": "BG",
    "370": "LT", "371": "LV", "372": "EE", "373": "MD", "374": "AM",
    "375": "BY", "376": "AD", "377": "MC", "378": "SM", "380": "UA",
    "381": "RS", "382": "ME", "383": "XK", "385": "HR", "386": "SI",
    "387": "BA", "389": "MK",
    "420": "CZ", "421": "SK", "423": "LI",
    "500": "FK", "501": "BZ", "502": "GT", "503": "SV", "504": "HN",
    "505": "NI", "506": "CR", "507": "PA", "508": "PM", "509": "HT",
    "590": "GP", "591": "BO", "592": "GY", "593": "EC", "594": "GF",
    "595": "PY", "596": "MQ", "597": "SR", "598": "UY", "599": "CW",
    "670": "TL", "672": "NF", "673": "BN", "674": "NR", "675": "PG",
    "676": "TO", "677": "SB", "678": "VU", "679": "FJ", "680": "PW",
    "681": "WF", "682": "CK", "683": "NU", "685": "WS", "686": "KI",
    "687": "NC", "688": "TV", "689": "PF", "690": "TK", "691": "FM",
    "692": "MH",
    "850": "KP", "852": "HK", "853": "MO", "855": "KH", "856": "LA",
    "880": "BD", "886": "TW",
    "960": "MV", "961": "LB", "962": "JO", "963": "SY", "964": "IQ",
    "965": "KW", "966": "SA", "967": "YE", "968": "OM", "970": "PS",
    "971": "AE", "972": "IL", "973": "BH", "974": "QA", "975": "BT",
    "976": "MN", "977": "NP", "992": "TJ", "993": "TM", "994": "AZ",
    "995": "GE", "996": "KG", "998": "UZ"
};

const SALESIQ_PORTAL = "tradelicensezone";
const SNOOZE_FUNCTION_NAME = "missed_chat_flyout_delay";

let currentUserInfo = { id: "", name: "" };

ZOHO.embeddedApp.on("PageLoad", async (entity) => {
    const loader = document.getElementById("loader-overlay");
    if (loader) loader.classList.remove("hidden");

    // Debug: log the raw payload once so you can confirm the exact shape
    // it arrives in. Remove this line once confirmed.
    console.log("[PageLoad] Raw payload:", entity);

    try {
        // Fetch current user details via ZDK/Config (still needed for the snooze call)
        const userConfig = await ZOHO.CRM.CONFIG.getCurrentUser();
        console.log("[User Info] Raw config response:", userConfig);

        if (userConfig) {
            const userData = userConfig.users ? userConfig.users[0] : (userConfig.Users ? userConfig.Users[0] : userConfig);
            if (userData) {
                currentUserInfo.id = userData.id || userData.user_id || "";
                currentUserInfo.name = userData.full_name || `${userData.first_name || ""} ${userData.last_name || ""}`.trim() || userData.name || "";
            }
        }
        console.log("[User Info] Resolved current user:", currentUserInfo);

        // Pull missedChats directly out of the flyout payload instead of
        // calling the salesiq_missed_chat_flyout Deluge function again.
        // Client Script sends: flyout.open({...}, { data: { missedChats } })
        let missedChats = null;

        if (entity && Array.isArray(entity.missedChats)) {
            missedChats = entity.missedChats;
        } else if (entity && entity.data && Array.isArray(entity.data.missedChats)) {
            missedChats = entity.data.missedChats;
        } else if (Array.isArray(entity)) {
            missedChats = entity;
        }

        if (!Array.isArray(missedChats)) {
            throw new Error("No missed chat data received from Client Script.");
        }

        // Sort newest first
        missedChats.sort((a, b) => Number(b.missed_time) - Number(a.missed_time));

        if (missedChats.length === 0) {
            console.log("[Missed Chats] No missed chats found. Automatically closing widget.");
            if (loader) loader.classList.add("hidden");
            if (typeof $Client !== 'undefined' && typeof $Client.close === 'function') {
                $Client.close();
            }
            return;
        }

        renderChats(missedChats);
        if (loader) loader.classList.add("hidden");

    } catch (err) {
        if (loader) loader.classList.add("hidden");
        showPopup("Data Fetch Error", err.message, "error");
    }
});

ZOHO.embeddedApp.init();

document.addEventListener("change", (event) => {
    if (event.target && event.target.id === "snoozeSelect") {
        const duration = parseInt(event.target.value, 10);
        if (!isNaN(duration)) {
            console.log(`[Snooze] User selected snooze duration: ${duration}`);

            // Close immediately — don't wait for the backend function call
            if (typeof $Client !== 'undefined' && typeof $Client.close === 'function') {
                console.log("[Snooze] Closing flyout...");
                $Client.close({ snooze_duration: duration });
            }

            // Fire the snooze function in the background (fire-and-forget)
            const snoozePayload = {
                "arguments": JSON.stringify({
                    "snooze_duration": duration.toString(),
                    "user_id": currentUserInfo.id.toString(),
                    "user_name": currentUserInfo.name
                })
            };

            console.log(`[Snooze] Executing ${SNOOZE_FUNCTION_NAME} with payload:`, snoozePayload);

            ZOHO.CRM.FUNCTIONS.execute(SNOOZE_FUNCTION_NAME, snoozePayload)
                .then((snoozeResponse) => {
                    console.log("[Snooze] Function execution result:", snoozeResponse);
                    console.log("[Snooze] Backend update triggered successfully.");
                })
                .catch((err) => {
                    console.error("[Snooze] Failed to trigger snooze function:", err);
                });
        }
    }
});

function renderChats(chats) {
    const list = document.getElementById("chat-list");
    const emptyState = document.getElementById("empty-state");
    const countEl = document.getElementById("missed-count");

    countEl.textContent = chats.length;

    if (!chats.length) {
        list.innerHTML = "";
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    list.innerHTML = chats.map(buildRowHtml).join("");
}

function buildRowHtml(chat) {
    const name = chat.name || "Unknown visitor";
    const phone = chat.phone || "No number";
    const iso = isoFromDialingCode(chat.dialing_code);
    const flagHtml = flagImgHtml(iso);
    const link = salesIqLink(chat.id);
    const sev = severity(chat.missed_time);
    const time = timeAgo(chat.missed_time);
    const fullTime = formatTime(chat.missed_time);
    const question = chat.question || "No message";

    return `
        <div class="chat-row sev-${sev}">
            <div class="chat-avatar">${initials(name)}</div>
            <div class="chat-body">
                <div class="chat-row-top">
                    <span class="chat-name">${flagHtml}${escapeHtml(name)}</span>
                </div>
                <p class="chat-question">${escapeHtml(question)}</p>
                <div class="chat-row-bottom">
                    <div class="chat-meta">
                        <span class="chat-phone">${escapeHtml(phone)}</span>
                        <span class="chat-time" title="${fullTime}">${time}</span>
                    </div>
                    <a href="${link}" target="_blank" rel="noopener" class="chat-reply">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 17 4 12 9 7"></polyline>
                            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                        </svg>
                        Reply
                    </a>
                </div>
            </div>
        </div>
    `;
}

function initials(name) {
    return (name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0])
        .join("")
        .toUpperCase();
}

function formatTime(epochMsStr) {
    if (!epochMsStr) return "";
    const d = new Date(Number(epochMsStr));
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + " - " +
           d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function salesIqLink(conversationId) {
    return `https://salesiq.zoho.com/${SALESIQ_PORTAL}/allchats/${conversationId}`;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function showPopup(titleText, message, type = "error") {
    const popup = document.getElementById(SELECTORS.popup);
    const iconDiv = document.getElementById("statusIcon");
    const title = document.getElementById(SELECTORS.popupTitle);
    const msg = document.getElementById(SELECTORS.popupMessage);

    popup.classList.remove("hidden");
    title.textContent = titleText;
    msg.innerHTML = message;

    if (type === "success") {
        popup.setAttribute("data-status", "success");
        iconDiv.className = "status-icon status-icon--success";
        iconDiv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
    } else {
        popup.setAttribute("data-status", "error");
        iconDiv.className = "status-icon status-icon--error";
        iconDiv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
    }
}

function severity(epochMsStr) {
    const ms = Number(epochMsStr);
    if (isNaN(ms)) return "ok";
    const diffMin = (Date.now() - ms) / 60000;
    if (diffMin >= 15) return "urgent";
    if (diffMin >= 5) return "warn";
    return "ok";
}

function timeAgo(epochMsStr) {
    const ms = Number(epochMsStr);
    if (isNaN(ms)) return "";
    const diffMin = Math.floor((Date.now() - ms) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
}


function isoFromDialingCode(dialingCode) {
    if (!dialingCode) return null;
    const code = String(dialingCode).replace(/\D/g, "");
    return DIALING_CODE_TO_ISO[code] || null;
}

function flagImgHtml(iso2) {
    if (!iso2) return "";
    const code = iso2.toLowerCase();
    return `<img class="chat-flag-img" src="https://flagcdn.com/w20/${code}.png" srcset="https://flagcdn.com/w40/${code}.png 2x" alt="${iso2}" title="${iso2}">`;
}