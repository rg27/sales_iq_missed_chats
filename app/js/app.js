const SELECTORS = {
    popup: "popup",
    popupTitle: "popupTitle",
    popupMessage: "popupMessage",
    loaderText: "loader-text"
};

const SALESIQ_PORTAL = "tradelicensezone";
const FUNCTION_NAME = "salesiq_missed_chat_flyout";
const SNOOZE_FUNCTION_NAME = "missed_chat_flyout_delay";

let currentUserInfo = { id: "", name: "" };

ZOHO.embeddedApp.on("PageLoad", async (entity) => {
    const loader = document.getElementById("loader-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        // Fetch current user details via ZDK/Config
        const userConfig = await ZOHO.CRM.CONFIG.getCurrentUser();
        console.log("[User Info] Raw config response:", userConfig);

        if (userConfig) {
            // Handle different possible response structures from Zoho SDK
            const userData = userConfig.users ? userConfig.users[0] : (userConfig.Users ? userConfig.Users[0] : userConfig);
            if (userData) {
                currentUserInfo.id = userData.id || userData.user_id || "";
                currentUserInfo.name = userData.full_name || `${userData.first_name || ""} ${userData.last_name || ""}`.trim() || userData.name || "";
            }
        }
        console.log("[User Info] Resolved current user:", currentUserInfo);

        const response = await ZOHO.CRM.FUNCTIONS.execute(FUNCTION_NAME, {});
        const details = response.details || response._details;
        if (!details || !details.output) {
            throw new Error("No data returned from SalesIQ function.");
        }

        const rawOutput = details.output;
        let jsonString = (typeof rawOutput === "string") ? rawOutput.trim() : JSON.stringify(rawOutput);
        if (typeof rawOutput === "string" && !jsonString.startsWith("[")) {
            jsonString = `[${jsonString}]`;
        }

        const missedChats = JSON.parse(jsonString);
        if (!Array.isArray(missedChats)) {
            throw new Error("Unexpected data shape returned from SalesIQ function.");
        }

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

document.addEventListener("change", async (event) => {
    if (event.target && event.target.id === "snoozeSelect") {
        const duration = parseInt(event.target.value, 10);
        if (!isNaN(duration)) {
            console.log(`[Snooze] User selected snooze duration: ${duration}`);
            
            try {
                const snoozePayload = {
                    "arguments": JSON.stringify({
                        "snooze_duration": duration.toString(),
                        "user_id": currentUserInfo.id.toString(),
                        "user_name": currentUserInfo.name
                    })
                };
                
                console.log(`[Snooze] Executing ${SNOOZE_FUNCTION_NAME} with payload:`, snoozePayload);

                const snoozeResponse = await ZOHO.CRM.FUNCTIONS.execute(SNOOZE_FUNCTION_NAME, snoozePayload);
                
                console.log("[Snooze] Function execution result:", snoozeResponse);
                console.log("[Snooze] Backend update triggered successfully.");

            } catch (err) {
                console.error("[Snooze] Failed to trigger snooze function:", err);
            }

            if (typeof $Client !== 'undefined' && typeof $Client.close === 'function') {
                console.log("[Snooze] Closing flyout...");
                $Client.close({ snooze_duration: duration });
            }
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
    const link = salesIqLink(chat.id);
    const time = formatTime(chat.missed_time);
    const question = chat.question || "No message";

    return `
        <div class="chat-row">
            <div class="chat-avatar">${initials(name)}</div>
            <div class="chat-body">
                <div class="chat-row-top">
                    <span class="chat-name">${escapeHtml(name)}</span>
                </div>
                <p class="chat-question">${escapeHtml(question)}</p>
                <div class="chat-row-bottom">
                    <div class="chat-meta">
                        <span class="chat-phone">${escapeHtml(phone)}</span>
                        <span class="chat-time">${time}</span>
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