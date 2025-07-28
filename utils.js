export const browserAPI = typeof browser !== "undefined" ? browser : chrome;

export async function runInTab(tabId, func, args = []) {
	const [{result}] = await browserAPI.scripting.executeScript({target: {tabId}, func, args});
	return result;
}