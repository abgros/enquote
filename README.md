# Enquote - Wiktionary Quote Generator

A browser extension that generates Wiktionary quotes from certain social media and news sites.

You can install it on the Chrome web store [here](https://chromewebstore.google.com/detail/enquote/hleooaeilbhgminhijkkdkfllibkheko).

## Usage

1. Go to a tweet or Reddit post, or news article
2. If on a news article, make sure you have the passage copied to your clipboard
3. Click the extension icon
4. Click "Quote" - formatted quote copied to clipboard
5. Paste into Wiktionary

## Manual installation steps

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder

**Firefox:**
1. Copy the contents of `manifest-firefox.json` into `manifest.json`
2. Go to `about:debugging` -> "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

## Compilation steps
This prepares the extension to be uploaded for the Chrome and Firefox web stores.

1. Run compile.py
2. Observe that two zip files have been generated: enquote.zip and enquote-firefox.zip.