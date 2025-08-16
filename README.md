# Enquote - Wiktionary Quote Generator

A browser extension that generates Wiktionary quotes from certain social media sites, news sites, archive.org books, and Google Books items.

You can install it on the Chrome web store [here](https://chromewebstore.google.com/detail/enquote/hleooaeilbhgminhijkkdkfllibkheko).

## Usage

1. Go to a tweet, Reddit post, news article, archive.org book, or Google Books item
2. Make sure you have the passage copied to your clipboard (not necessary if you're doing Twitter)
3. Click the extension icon
4. Click "Quote"
5. Wait for the button to say "Copied!"
6. Paste into Wiktionary

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