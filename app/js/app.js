const SELECTORS = {
    popup: "popup",
    popupTitle: "popupTitle",
    popupMessage: "popupMessage",
    loaderText: "loader-text"
};

// Portal name used to build the SalesIQ conversation link.
const SALESIQ_PORTAL = "tradelicensezone";
const FUNCTION_NAME = "salesiq_missed_chat_flyout"; // must match the Deluge function's API name

ZOHO.embeddedApp.on("PageLoad", async (entity) => {
    const loader = document.getElementById("loader-overlay");
    if (loader) loader.classList.remove("hidden");

    console.log("RAW PageLoad Entity Object:", entity);

    try {
        // Function takes no arguments now — filtering happens server-side.
        const response = await ZOHO.CRM.FUNCTIONS.execute(FUNCTION_NAME, {});
        console.log("Function response:", response);

        const details = response.details || response._details;
        if (!details || !details.output) {
            throw new Error("No data returned from SalesIQ function.");
        }

        const rawOutput = details.output;
        console.log("[Missed Chats] Raw output type:", typeof rawOutput, "Data:", rawOutput);

        let jsonString = (typeof rawOutput === "string") ? rawOutput.trim() : JSON.stringify(rawOutput);
        if (typeof rawOutput === "string" && !jsonString.startsWith("[")) {
            jsonString = `[${jsonString}]`;
        }

        const missedChats = JSON.parse(jsonString);
        console.log("[Missed Chats] Parsed OK. Count:", missedChats.length);

        if (!Array.isArray(missedChats)) {
            throw new Error("Unexpected data shape returned from SalesIQ function.");
        }

        renderChats(missedChats);
        console.log("[Missed Chats] renderChats() called successfully.");

        if (loader) loader.classList.add("hidden");

    } catch (err) {
        if (loader) loader.classList.add("hidden");
        showPopup("Data Fetch Error", err.message, "error");
    }
});

ZOHO.embeddedApp.init();

function renderChats(chats) {
    const list = document.getElementById("chat-list");
    const emptyState = document.getElementById("empty-state");
    const countEl = document.getElementById("missed-count");

    console.log("[Missed Chats] renderChats() — elements found:", {
        list: !!list,
        emptyState: !!emptyState,
        countEl: !!countEl
    });
    console.log("[Missed Chats] Rendering", chats.length, "row(s).");

    countEl.textContent = chats.length + " missed";

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
                    <a href="${link}" target="_blank" rel="noopener" class="chat-view">View</a>
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