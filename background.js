import { runInTab, browserAPI } from "./utils.js";

let responseCallback;

browserAPI.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg.type === "wait_for_archiveurl") {
		responseCallback = sendResponse;
		pollTabUrl(msg.tabId, msg.url);
		return true; // for async response
	}
});

async function pollTabUrl(tabId, url) {
	await runInTab(tabId, url => {
		document.querySelector("#archive").value = url;
		document.querySelector(`[value="Submit for archival"]`).click();
	}, [url]);

	for (let i = 0; i < 100; i++) {
		const tab = await browserAPI.tabs.get(tabId);
		const url = tab.url;

		if (url.match(/^https:\/\/ghostarchive\.org\/archive\//)) {
			responseCallback({ archiveurl: url.replace("wip/", ""), isoDate: new Date().toISOString().split("T")[0] });
			return;
		}

		// sleep for 100 ms
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	responseCallback({ archiveurl: "", isoDate: "" });
}