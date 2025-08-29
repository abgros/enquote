import {runInTab, browserAPI} from "./utils.js";

// https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
const alwaysLower = ["and", "as", "but", "for", "if", "nor", "or", "so", "yet", "a", "an",
	"the", "as", "at", "by", "for", "in", "of", "off", "on", "per", "to", "up", "via"];

function titleCase(s) {
	const parts = s.split(/\b/);
	for (let i = 0; i < parts.length; i++) {
		const isLowerCase = /^[a-z]{2,}$/.test(parts[i]);
		// words in alwaysLower are exempt unless they are the first part
		if (isLowerCase && (!alwaysLower.includes(parts[i]) || parts === 0)) {
			parts[i] = parts[i].at(0).toUpperCase() + parts[i].substr(1);
		}
	}

	return parts.join("");
}

// Format date as "DD Month YYYY" (e.g., "15 January 2024")
function formatDate(dateStr) {
	const date = new Date(dateStr);
	const day = date.getUTCDate();
	const month = date.toLocaleString("en-US", {month: "long", timeZone: "UTC"});
	const year = date.getUTCFullYear();
	return `${day} ${month} ${year}`;
}

// Make sure text is on one line with characters normalized
function formatText(str) {
	return str.trim()
		.replace(/\n\s+/g, " ¶ ")
		.replace(/\s+/g, " ")
		.replaceAll("|", "{{!}}")
		.replaceAll("’", "'")
		.replaceAll("‘", "'")
		.replaceAll("”", "\"")
		.replaceAll("“", "\"")
		.replaceAll("…", "...");
}

// Takes an array of authors and returns an object of author parameters
function consolidateAuthors(authors) {
	if (!Array.isArray(authors))
		return {};

	return authors.reduce((acc, next, i) => {
		if (i === 0)
			acc["author"] = next;
		else
			acc[`author${i + 1}`] = next;

		return acc;
	}, {});
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
	const url = currentTab.url;
	const cleanUrl = url.split("?")[0]; // Remove query parameters
	const urlQuery = new URLSearchParams(url);
	const id = currentTab.id;
	const clipboardContents = await navigator.clipboard.readText();

	// Match different social media URLs
	const urlPatterns = new Map([
		["Twitter", /^https:\/\/x\.com\/([a-zA-Z0-9_]+)\/status\/[0-9]+$/],
		["RedditComment", /^https:\/\/www\.reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\/[a-z0-9]+\/comment\/[a-z0-9]+\/$/],
		["RedditPost", /^https:\/\/www\.reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\//],
		["InternetArchiveItem", /^https:\/\/archive\.org\/details\//],
		["GoogleBooks", /^https:\/\/www\.google\.[a-z]+\/books\/edition\/[^/]+\/([a-zA-Z0-9-_]+)/],
		["NationalCorpusOfPolish", /^https:\/\/nkjp\.pl\/poliqarp\/[a-z0-9-]+\/query\/\d+\/$/],
		["Polona", /^https:\/\/polona\.pl\/(?:preview|item-view)\/([^/]+)/]
	]);

	let matchedUrl, matchedUrlObj;
	for (const [key, regex] of urlPatterns) {
		const try_match = cleanUrl.match(regex);
		if (try_match) {
			[matchedUrl, matchedUrlObj] = [key, try_match];
			break;
		}
	}

	// try to grab archive.org or google book
	if (matchedUrl === "InternetArchiveItem") {
		let isBook = await runInTab(id, () => document.querySelector(`[property="mediatype"]`).content);
		if (isBook !== "texts") {
			alert("This archive.org item is not a text item.");
			return;
		}
		const data = await runInTab(id, () => JSON.parse(document.querySelector(".js-ia-metadata").value));
		let {identifier, title, year, date, publisher, creator, isbn} = data.metadata;
		publisher = publisher ?? "";
		isbn = Array.isArray(isbn) ? isbn[0] : isbn;

		// try to extract page parameters
		const page = cleanUrl.match(/\/page\/(n?[0-9]+)\/mode\//)?.[1] ?? await runInTab(id, () => {
			// IA uses a lot of shadow roots
			const getRoots = e => [e, ...e.querySelectorAll("*")].filter(e => e.shadowRoot).flatMap(e => [e.shadowRoot, ...getRoots(e.shadowRoot)]);
			const pageNum = getRoots(document).flatMap(r => [...r.querySelectorAll(".page-num")])[0];
			return pageNum.textContent.replace("Page ", "");
		});

		const pageurl = page ? `https://archive.org/details/${identifier}/page/${page}/mode/1up` : "";

		const [locationPart, publisherPart] = publisher.includes(" : ") ? publisher.split(" : ") : ["", publisher];
		const urlParam = `https://archive.org/details/${identifier}/`;

		return buildQuote({
			author: creator,
			year: year ?? date.match(/[0-9]{4}/)[0],
			title: formatText(titleCase(title).replaceAll(" : ", ": ")),
			location: locationPart,
			publisher: publisherPart,
			url: urlParam,
			page: page.startsWith("n") ? "unnumbered" : page,
			pageurl,
			isbn,
			passage: formatText(clipboardContents) || formatText(title)
		}, `{{quote-book|${langcode || "en"}|`);
	} else if (matchedUrl === "GoogleBooks") {
		// call into the Google Books API
		const volumeId = matchedUrlObj[1];
		const apiUrl = `https://www.googleapis.com/books/v1/volumes/${volumeId}`;
		const data = await fetch(apiUrl).then(resp => resp.json());

		const {authors, title, publishedDate, publisher, industryIdentifiers, subtitle} = data.volumeInfo;
		const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
		console.log(data.volumeInfo);

		let isbn;
		if (industryIdentifiers) {
			const isbn13 = industryIdentifiers.find(ident => ident.type === "ISBN_13");
			if (isbn13) {
				isbn = isbn13.identifier;
			} else {
				const isbn10 = industryIdentifiers.find(ident => ident.type === "ISBN_10");
				isbn = isbn10 ? isbn10.identifier : "";
			}
		}

		const pageParam = urlQuery.get("pg") ?? "";
		const page = pageParam.match(/\d+/) ? pageParam.match(/\d+/)[0] : "";
		const urlParam = `https://books.google.com/books?id=${volumeId}`;
		const pageurl = pageParam ? `${urlParam}&pg=${pageParam}` : "";

		return buildQuote({
			...consolidateAuthors(authors),
			year: publishedDate.match(/[0-9]{4}/)[0],
			title: fullTitle,
			location: "",
			publisher,
			url: urlParam,
			page,
			pageurl,
			isbn,
			passage: formatText(clipboardContents) || formatText(title)
		}, `{{quote-book|${langcode || "en"}|`);
	} else if (matchedUrl === "NationalCorpusOfPolish") {
		const passage = await runInTab(id, () => document.querySelector(`#result-context`).textContent);
		const metadata = await runInTab(id, () => Object.fromEntries(
			[...document.querySelectorAll(".result-metadata dt")].map(elem => [elem.textContent, elem.nextElementSibling.textContent])
		));
		const quoteKind = metadata["channel"] === "book" ? "book" : metadata["publisher"] === "Usenet" ? "usenet" : "journal";
		const rawDate = (metadata["published"] || metadata["date"]).split(";")[0];

		return buildQuote({
			...consolidateAuthors(metadata["author"].split("; ")),
			title: metadata["title"],
			location: metadata["publication place"],
			publisher: metadata["publisher"],
			...(rawDate.match("^[0-9]{4}$") ? {year: rawDate} : {date: rawDate}),
			issn: metadata["ISSN"],
			isbn: metadata["ISBN"],
			passage: `{{...}} ${formatText(passage)} {{...}}`,
		}, `{{quote-${quoteKind}|${langcode || "en"}|`);
	} else if (matchedUrl === "Polona") {
		const workId = matchedUrlObj[1];

		// janky hack to open the Informacje tab
		if (url.includes("item-view") && await runInTab(id, () => !document.querySelector(".metadata-info-container-scroll"))) {
			await runInTab(id, () => document.querySelector(`[aria-label="Informacje"]`).click());
		}

		const metadata = await runInTab(id, () => Object.fromEntries(
			[...document.querySelectorAll("bn-object-metadata-item")].map(elem => {
				let divs = elem.querySelectorAll("div");
				return [divs[1].textContent.trim(), divs[2].textContent.trim()];
			})
		));
		const title = await runInTab(id, () => document.querySelector(".title-section h2, h5").textContent);
		const date = await runInTab(id, () => document.querySelector("h2 + div, h5 + h6").textContent);
		const page = await runInTab(id, () => document.querySelector("bn-viewer-page-select")?.textContent.match("karta \\[?([^|\\]]+)")[1].trim());

		return buildQuote({
			author: metadata["Autor"].split("(")[0].trim(),
			title: formatText(title),
			date,
			location: metadata["Miejsce wydania"],
			publisher: metadata["Wydawca"],
			url: `https://polona.pl/preview/${workId}`,
			page: page,
			pageurl: page && url,
			passage: formatText(clipboardContents) || formatText(title)
		}, "{{quote-book|pl|");
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


	if (!matchedUrl && !gotJsonLD) return;

	const [archiveurl, archivedate] = await archive(currentTab);

	if (matchedUrl === "Twitter") {
		const author = matchedUrlObj[1];
		date = await runInTab(id, () => document.querySelector(`[aria-label*=" · "] > time`).dateTime);
		passage = await runInTab(id, () => document.querySelector(`article:has([aria-label*=" · "]) [data-testid="tweetText"]`)?.textContent ?? "");

		return buildQuote({
			author: `@${author}`,
			site: "w:Twitter",
			url: cleanUrl,
			archiveurl,
			archivedate,
			date: formatDate(date),
			passage: formatText(passage)
		}, `{{quote-book|${langcode || "en"}|`);
	} else if (matchedUrl === "RedditComment") {
		const author = await runInTab(id, () => document.querySelector(".author-name-meta").textContent.trim());
		title = await runInTab(id, () => document.querySelector(`[slot="title"]`).textContent.trim());
		date = formatDate(await runInTab(id, () => document.querySelector(`[slot="commentMeta"] time`).dateTime));
		passage = await runInTab(id, () => document.querySelector(`[slot="comment"] > div`).textContent);

		const subreddit = matchedUrlObj[1];

		return buildQuote({
			...(author !== "[deleted]" && {author: `u/${author}`}),
			title: formatText(title),
			site: "w:Reddit",
			url: cleanUrl,
			archiveurl,
			archivedate,
			location: `r/${subreddit}`,
			date: formatDate(date),
			passage: formatText(clipboardContents) || formatText(passage) || formatText(title)
		}, `{{quote-book|${langcode || "en"}|`);
	} else if (matchedUrl === "RedditPost") {
		const author = await runInTab(id, () => document.querySelector(".author-name").textContent);
		title = await runInTab(id, () => document.querySelector(`[slot="title"]`).textContent.trim());
		date = await runInTab(id, () => document.querySelector("time").dateTime);
		passage = await runInTab(id, () => {
			const postElem = document.querySelector(`[property="schema:articleBody"]`);
			return postElem ? postElem.textContent : "";
		});

		const subreddit = matchedUrlObj[1];

		return buildQuote({
			...(author !== "[deleted]" && {author: `u/${author}`}),
			title: formatText(title),
			site: "w:Reddit",
			url: cleanUrl,
			archiveurl,
			archivedate,
			location: `r/${subreddit}`,
			date: formatDate(date),
			passage: formatText(clipboardContents) || formatText(passage) || formatText(title)
		}, `{{quote-book|${langcode || "en"}|`);
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

		authors = authors.filter(author => author !== publisher);

		return buildQuote({
			...consolidateAuthors(authors),
			title: formatText(title),
			...(!rq && {site: publisher}),
			url: cleanUrl,
			archiveurl,
			archivedate,
			date: formatDate(date),
			passage: formatText(clipboardContents) || formatText(title)
		}, rq ? `{{RQ:${rq}|` : `{{quote-book|${langcode || "en"}|`);
	}
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

const button = document.querySelector("button");
button.addEventListener("click", async () => {
	try {
		const quote = await getQuote();
		if (quote) {
			await navigator.clipboard.writeText(quote);
			button.textContent = "Copied!";
		} else {
			alert("Could not extract a quote from this page.");
		}
	} catch (err) {
		console.error(err);
		alert(`An error occurred:\n${err.stack}`);
	}
});

let langcode;

const lang = document.querySelector("input");
browserAPI.storage.sync.get(["language"], result => {
	lang.value = result.language;
	langcode = result.language;
});

lang.addEventListener("change", () => {
	langcode = lang.value;
	browserAPI.storage.sync.set({language: lang.value}, () => {});
});