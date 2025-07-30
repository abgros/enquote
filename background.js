import {runInTab, browserAPI} from "./utils.js";

let responseCallback;

browserAPI.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg.type === "wait_for_archiveurl") {
		responseCallback = sendResponse;
		pollTabUrl(msg.tabId);
		return true; // for async response
	}
});

async function pollTabUrl(tabId) {
	for (let i = 0; i < 100; i++) {
		const tab = await browserAPI.tabs.get(tabId);
		const url = tab.url;

		if (url.match(/^https:\/\/archive\.ph\/(?:wip\/)?[a-zA-Z0-9]+$/)) {
			const isoDate = await runInTab(tabId, () => {
				const timeElem = document.querySelector("#HEADER time");
				return timeElem ? timeElem.dateTime.split("T")[0] : new Date().toISOString().split("T")[0];
			});
			responseCallback({archiveurl: url.replace("wip/", ""), isoDate});
			return;
		}

		// sleep for 100 ms
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	responseCallback({archiveurl: "", isoDate: ""});
}