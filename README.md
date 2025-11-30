# Enquote - Wiktionary Quote Generator

A browser extension that generates Wiktionary quotes from various sites.

## Supported sites
- Most news sites
- Reddit
- Twitter
- Bluesky
- archive.org (books)
- Google Books
- nkjp.pl
- polona.pl

You can install it on the Chrome web store [here](https://chromewebstore.google.com/detail/enquote/hleooaeilbhgminhijkkdkfllibkheko).

## Usage

1. Go to a supported website
2. Make sure you have the passage copied to your clipboard (not necessary for: Twitter, Bluesky, nkjp.pl)
3. Click the extension icon
4. Click "Quote"
5. Wait for the button to say "Copied!"
6. Paste into Wiktionary

### Notes
- If you click away before the word "Copied!" appears, the extension closes and you'll have to re-run it. This is a limitation caused by the browser.
- If the archive.ph tab stays open for a long time, it probably wants you to do a security check. Switch to the archive.ph tab, complete it, then come back and re-run the extension.

## Manual installation steps
Publishing an update to the Chrome or Firefox web stores can take several days, so it may be behind
the latest development version in terms of bug fixes and features. You can download the extension
directly from Github [here](https://github.com/abgros/enquote/archive/refs/heads/master.zip); unzip the folder and install it as follows:

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder

**Firefox:**
1. Copy the contents of `manifest-firefox.json` into `manifest.json` within this folder
2. Go to `about:debugging` -> "This Firefox"
3. Click "Load Temporary Add-on..."
4. Select `manifest.json`

## Compilation steps
This prepares the extension to be uploaded for the Chrome and Firefox web stores.

1. Run compile.py
2. Observe that two zip files have been generated: enquote.zip and enquote-firefox.zip.