import { runInTab, browserAPI } from "./utils.js";

const awaitingTabs = new Map();

browserAPI.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	// Handle requests to wait for archive URL completion
	if (msg.type === "wait_for_archiveurl") {
		awaitingTabs.set(msg.tabId, sendResponse);
		// Return true to indicate an asynchronous response
		return true;
	}
});

async function handleArchiveNavigation(details) {
	const {tabId, url} = details;
	const match = url.match(/^https:\/\/archive\.ph\/(?:wip\/)?[a-zA-Z0-9]+$/);
	const responseCallback = awaitingTabs.get(tabId);

	if (match && responseCallback) {
		// Extract the archive date from the page or get today's date
		const isoDate = await runInTab(tabId, () => {
			const timeElem = document.querySelector("#HEADER time");
			const verboseDate = timeElem ? timeElem.dateTime : new Date().toISOString();
			return verboseDate.split("T")[0];
		});

		awaitingTabs.delete(tabId);

		// Send the archive data back to the popup script, remove "wip/" from URL
		responseCallback({archiveurl: url.replace("wip/", ""), isoDate});
	}
}

// Listen for navigation events - both when navigation starts and completes
// This ensures we catch the archive page whether it loads directly or redirects
browserAPI.webNavigation.onCommitted.addListener(handleArchiveNavigation);
browserAPI.webNavigation.onCompleted.addListener(handleArchiveNavigation);