export const browserAPI = typeof browser !== "undefined" ? browserAPI : chrome;

export async function runInTab(tabId, func, args = []) {
	const [{result}] = await browserAPI.scripting.executeScript({target: {tabId}, func, args});
	return result;
}