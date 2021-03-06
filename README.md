# CS:GO Trade Helper

Implements a variety of features to improve both the Steam Community and trading for CS:GO.
CS:GO Trade Helper improves the appearance of Steam pages and, in various ways, assists trading in CS:GO through the Steam Community website.

For more information, add me on [Steam](https://steamcommunity.com/id/i7xx) or visit the [website](https://i7xx.xyz/helper).

[![Chrome Web Store](https://developer.chrome.com/webstore/images/ChromeWebStore_Badge_v2_206x58.png)](https://chrome.google.com/webstore/detail/csgo-trade-helper/miogdaopejcmpcjhkdaflnkcafghgkfc/)
![Icon](assets/notification.png)

---

## Screenshots

Screenshots can be seen at [i7xx.xyz/helper](https://i7xx.xyz/helper) and a video is [available here](https://www.youtube.com/watch?v=oVqyQOmdZCE).

---

## Features

- utilised a hidden Steam feature to enable upvoting on user profiles

- improved aesthetics on Steam Community

- ability to see fade percentages, case hardened tiers and Doppler phases for items quickly inside a trade offer or on an inventory page

- improved functionality within trade offers (summary of items inside the trade offer, item quantity, total price, ability to quickly add a large number of keys, take all items on the page, shortcuts to csgo.exchange showcases and metjm.net screenshots, quickly see float values and item prices)

- improved functionality on the market page (quick links to float value and screenshots, stickers listed inline)

- improved functionality on trade offers page (ability to quickly summarise trade offers and view total price, item quantity and types, stickers, float value)

- improved functionality on the invites page (view total inventory value and view SteamREP.com status)

- improved functionality on 'friends' pages (search friend's items)

- improved functionality on profile page (improved aesthetics, verification for important and/or high tier profiles)

- improved functionality on inventory history page (each trade history item is formatted with pricing, items are aligned and easier to read)

- notifications for new profile comments, new friend invites, new trade offers and new items

- verification flairs for high tier trades/profiles

- scammer verification (scammers are evident and are marked with red backgrounds and red flairs on the invites page and on their profiles)

- multiple pricing sourcing options

- quick sell button to assist in selling items quickly and list them at the lowest price on the market

---

## Permissions

- cookies: to allow the extension to automatically accept empty trade offers (when the setting is enabled)

- tabs: to communicate with a background script and tabs open on Steam Community

- storage: to save settings

- notifications: to provide notifications for comments/invites/items/trade offers

- webRequest/webRequestBlocking: to alter headers to enable CORS

---

## Installation - Developer

### Setting the extension up in Chrome

Refer to [Getting Started: Building a Chrome Extension](https://developer.chrome.com/extensions/getstarted) Guide.

1. Fork the repository and clone it. You can also just clone it if you just want to install it:
`git clone https://github.com/Rob--/CS-GO-Trade-Helper.git`

2. Load Chrome and open the extensions page: `chrome://extensions/`

3. Enable Developer Mode (tick box at the top of the page)

4. Click on 'Load unpacked extension' and open the folder with the extension. The Chrome Add-on is now loaded and ready to use

### Setting the extension up for development

This project uses gulp to minify code, therefore dependencies need to be installed from NPM.

1. In the root directory, open a terminal and run `npm install` to install the required dependencies

2. To run the gulp tasks to minify code, open a terminal and run `npm run gulp`