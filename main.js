import { runInTab, browserAPI } from "./utils.js";

const button = document.querySelector("button");

// Format date as "DD Month YYYY" (e.g., "15 January 2024")
function formatDate(dateStr) {
	const date = new Date(dateStr);
	const day = date.getUTCDate();
	const month = date.toLocaleString("en-US", {month: "long", timeZone: "UTC"});
	const year = date.getUTCFullYear();
	return `${day} ${month} ${year}`;
}

// Clean up passage text by removing extra whitespace
function formatPassage(passage) {
	return passage.trim().replace(/\s+/g, " ");
}

function buildQuote(obj) {
	const parts = ["#* {{quote-web", "en"];

	for (const [key, value] of Object.entries(obj)) {
		if (value)
			parts.push(`${key}=${value}`);
	}

	return parts.map(part => part
		.replaceAll("|", "{{!}}")
		.replaceAll("’", "'")
		.replaceAll("‘", "'")
		.replaceAll("”", "\"")
		.replaceAll("“", "\"")
		.replaceAll("…", "...")
	).join("|") + "}}";
}

async function getQuote() {
	const [currentTab] = await browserAPI.tabs.query({active: true, currentWindow: true});
	const url = currentTab.url.split("?")[0];  // Remove query parameters
	const id = currentTab.id;

	// Match different social media URLs
	const twitterMatch = url.match(/^https:\/\/x\.com\/([a-zA-Z0-9_]+)\/status\/[0-9]+$/);
	const redditCommentMatch = url.match(/^https:\/\/www\.reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\/[a-z0-9]+\/comment\/[a-z0-9]+\/$/);
	const redditPostMatch = url.match(/^https:\/\/www\.reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\//);

	if (!twitterMatch && !redditCommentMatch && !redditPostMatch) {
		alert("Invalid URL.");
		return;
	}

	const [archiveurl, archivedate] = await archive(currentTab);
	let quote;
	if (twitterMatch) {
		const author = twitterMatch[1];
		const date = await runInTab(id, () =>  document.querySelector(`[aria-label*=" · "] > time`).dateTime);
		const passage = await runInTab(id, () => document.querySelector(`article:has([aria-label*=" · "]) [data-testid="tweetText"]`).textContent);

		quote = buildQuote({
			author: `@${author}`,
			site: "w:Twitter",
			url,
			archiveurl,
			archivedate,
			date: formatDate(date),
			passage: formatPassage(passage)
		});
	} else if (redditCommentMatch) {
		const author = await runInTab(id, () => document.querySelector(".author-name-meta").textContent.trim());
		const title = await runInTab(id, () => document.querySelector(`[slot="title"]`).textContent.trim());
		const subreddit = redditCommentMatch[1];
		const date = formatDate(await runInTab(id, () => document.querySelector(`[slot="commentMeta"] time`).dateTime));
		const passage = await runInTab(id, () => document.querySelector(`[slot="comment"] > div`).textContent);

		quote = buildQuote({
			author: `u/${author}`,
			title,
			site: "w:Reddit",
			url,
			archiveurl,
			archivedate,
			location: `r/${subreddit}`,
			date: formatDate(date),
			passage: formatPassage(passage)
		});
	} else if (redditPostMatch) {
		const author = await runInTab(id, () => document.querySelector(".author-name").textContent);
		const title = await runInTab(id, () => document.querySelector(`[slot="title"]`).textContent.trim());
		const subreddit = redditPostMatch[1];
		const date = await runInTab(id, () => document.querySelector("time").dateTime);
		const passage = await runInTab(id, () => {
			const postElem = document.querySelector(`[property="schema:articleBody"]`);
			return postElem ? postElem.textContent : "";
		});

		quote = buildQuote({
			author: `u/${author}`,
			title,
			site: "w:Reddit",
			url,
			archiveurl,
			archivedate,
			location: `r/${subreddit}`,
			date: formatDate(date),
			passage: formatPassage(passage) || title
		});
	}

	await navigator.clipboard.writeText(quote);
	button.textContent = "Copied!";
}

// Archive the current page and return archive URL and date
async function archive(currentTab) {
	const url = currentTab.url.split("?")[0];
	const archiveSubmit = `https://archive.ph/submit/?url=${encodeURIComponent(url)}`;

	// Create a new browser tab next to the current one
	const tab = await browserAPI.tabs.create({url: archiveSubmit, index: currentTab.index + 1, active: false});

	// Wait for the tab to redirect to its final archiveurl, then close it
	const archiveResult = await browserAPI.runtime.sendMessage({type: "wait_for_archiveurl", tabId: tab.id});
	await browserAPI.tabs.remove(tab.id);

	const {archiveurl, isoDate} = archiveResult;
	const archivedate = formatDate(isoDate);

	return [archiveurl, archivedate];
}

button.addEventListener("click", async () => {
	try {
		await getQuote();
	} catch (err) {
		console.error(err);
		alert(`An error occurred:\n${err.stack}`);
	}
});