import {runInTab, browserAPI} from "./utils.js";

const button = document.querySelector("button");

// Format date as "DD Month YYYY" (e.g., "15 January 2024")
function formatDate(dateStr) {
	const date = new Date(dateStr);
	const day = date.getUTCDate();
	const month = date.toLocaleString("en-US", {month: "long", timeZone: "UTC"});
	const year = date.getUTCFullYear();
	return `${day} ${month} ${year}`;
}

// Make sure text is on one line with characters normalized
function formatText(valStr) {
	return valStr.trim()
		.replace(/[\n\r]+/g, " ¶ ")
		.replace(/\s+/g, " ")
		.replaceAll("|", "{{!}}")
		.replaceAll("’", "'")
		.replaceAll("‘", "'")
		.replaceAll("”", "\"")
		.replaceAll("“", "\"")
		.replaceAll("…", "...");
}

function buildQuote(obj, start) {
	const parts = [];
	for (const [key, value] of Object.entries(obj)) {
		if (value)
			parts.push(`${key}=${value}`);
	}

	return "#* " + start + parts.join("|") + "}}";
}

async function getQuote() {
	const [currentTab] = await browserAPI.tabs.query({active: true, currentWindow: true});
	const url = currentTab.url.split("?")[0]; // Remove query parameters
	const id = currentTab.id;

	// Match different social media URLs
	const urlPatterns = new Map([
		["Twitter", /^https:\/\/x\.com\/([a-zA-Z0-9_]+)\/status\/[0-9]+$/],
		["RedditComment", /^https:\/\/www\.reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\/[a-z0-9]+\/comment\/[a-z0-9]+\/$/],
		["RedditPost", /^https:\/\/www\.reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\//]
	]);

	let matchedUrl, matchedUrlObj;
	for (const [key, regex] of urlPatterns) {
		const try_match = url.match(regex);
		if (try_match) {
			[matchedUrl, matchedUrlObj] = [key, try_match];
			break;
		}
	}

	// try to grab JSON-LD data
	let passage;
	let [authors, date, title, publisher, gotJsonLD] = await runInTab(id, () => {
		let gotJsonLD = false;
		let authors, date, title, publisher;

		const newsTypes = ["NewsArticle", "ReportageNewsArticle", "Article"];
		const jsonLdIsArticle = data => {
			let typeStr = Array.isArray(data["@type"]) ? data["@type"][0] : data["@type"];
			return newsTypes.includes(typeStr);
		};

		for (const script of [...document.querySelectorAll(`script[type="application/ld+json"]`)]) {
			try {
				let data = JSON.parse(script.textContent);
				if (Array.isArray(data))
					data = data.find(jsonLdIsArticle);

				console.log("JSON-LD data:", data);

				// ensure @type value is correct
				if (!jsonLdIsArticle(data))
					continue;

				if (typeof data.author === "string")
					authors = [data.author];
				else if (typeof data.author.name === "string")
					authors = [data.author.name];
				else if (Array.isArray(data.author))
					authors = data.author.map(person => person.name);
				else
					continue;

				date = data.datePublished.split("T")[0];
				title = data.headline;
				publisher = data.publisher.name || data.publisher["@id"];
				gotJsonLD = true;
				break;
			} catch (e) {
				console.log("JSON-LD parse error:", e.stack);
			}
		}

		return [authors, date, title, publisher, gotJsonLD];
	});


	if (!matchedUrl && !gotJsonLD) {
		alert("Could not extract a quote from this page.");
		return;
	}

	const clipboardContents = await navigator.clipboard.readText();
	const [archiveurl, archivedate] = await archive(currentTab);

	let quote;
	if (matchedUrl === "Twitter") {
		const author = matches.twitter[1];
		date = await runInTab(id, () => document.querySelector(`[aria-label*=" · "] > time`).dateTime);
		passage = await runInTab(id, () => document.querySelector(`article:has([aria-label*=" · "]) [data-testid="tweetText"]`).textContent);

		quote = buildQuote({
			author: `@${author}`,
			site: "w:Twitter",
			url,
			archiveurl,
			archivedate,
			date: formatDate(date),
			passage: formatText(passage) || formatText(title)
		}, "{{quote-web|en|");
	} else if (matchedUrl === "RedditComment") {
		const author = await runInTab(id, () => document.querySelector(".author-name-meta").textContent.trim());
		title = await runInTab(id, () => document.querySelector(`[slot="title"]`).textContent.trim());
		date = formatDate(await runInTab(id, () => document.querySelector(`[slot="commentMeta"] time`).dateTime));
		passage = await runInTab(id, () => document.querySelector(`[slot="comment"] > div`).textContent);

		const subreddit = matchedUrlObj[1];

		quote = buildQuote({
			author: `u/${author}`,
			title: formatText(title),
			site: "w:Reddit",
			url,
			archiveurl,
			archivedate,
			location: `r/${subreddit}`,
			date: formatDate(date),
			passage: formatText(passage) || formatText(title)
		}, "{{quote-web|en|");
	} else if (matchedUrl === "RedditPost") {
		const author = await runInTab(id, () => document.querySelector(".author-name").textContent);
		title = await runInTab(id, () => document.querySelector(`[slot="title"]`).textContent.trim());
		date = await runInTab(id, () => document.querySelector("time").dateTime);
		passage = await runInTab(id, () => {
			const postElem = document.querySelector(`[property="schema:articleBody"]`);
			return postElem ? postElem.textContent : "";
		});

		const subreddit = matchedUrlObj[1];

		quote = buildQuote({
			author: `u/${author}`,
			title: formatText(title),
			site: "w:Reddit",
			url,
			archiveurl,
			archivedate,
			location: `r/${subreddit}`,
			date: formatDate(date),
			passage: formatText(passage) || formatText(title)
		}, "{{quote-web|en|");
	} else {
		const rq = new Map([
			["https://www.theatlantic.com/#publisher", "Atlantic"],
			["Daily Mail", "Daily Mail"],
			["The Economist", "Economist"],
			["Financial Times", "FT"],
			["The Globe and Mail", "G&M"],
			["The Guardian", "Guardian"],
			["The Independent", "Independent"],
			["Intelligencer", "New York"],
			["Los Angeles Times", "LATimes"],
			["National Post", "National Post"],
			["The New York Times", "NYT"],
			["The New Yorker", "New Yorker"],
			["New York Post", "NYPost"],
			["Rolling Stone", "Rolling Stone"],
			["Scientific American", "SciAm"],
			["Slate", "Slate"],
			["The Strategist", "New York"],
			["The Telegraph", "Telegraph"],
			["Time", "Time"],
			["The Times", "Times"],
			["Vanity Fair", "Vanity Fair"],
			["The Wall Street Journal", "WSJ"],
			["The Washington Post", "WaPo"],
			["WIRED", "Wired"],
		]).get(publisher);

		passage = clipboardContents;
		authors = authors.filter(author => author !== publisher);

		quote = buildQuote({
			...authors.reduce((acc, nextAuthor, index) => {
				index === 0 ? (acc.author = nextAuthor) : (acc[`author${index + 1}`] = nextAuthor);
				return acc;
			}, {}),
			title: formatText(title),
			...(!rq && {site: publisher}),
			url,
			archiveurl,
			archivedate,
			date: formatDate(date),
			passage: formatText(passage) || formatText(title)
		}, rq ? `{{RQ:${rq}|` : "{{quote-web|en|");
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