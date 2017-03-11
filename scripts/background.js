chrome.webRequest.onHeadersReceived.addListener(function(details){
    /* define the headers we want to inject */
    var injectHeaders = {
        'Access-Control-Allow-Origin': { value: '*', injected: false }/*,
        'Access-Control-Allow-Headers': { value: 'Content-Type', injected: false },
        'Access-Control-Allow-Methods': { value: 'GET,PUT,POST,DELETE,OPTIONS', injected: false }*/
    }

    /* loop over the current headers, if the header
     we want to inject is found, change the value */
    details.responseHeaders.forEach(function(e, i){
        if(Object.keys(injectHeaders).indexOf(e.name) == -1) return

        /* change the value of the existing header and set the injected
         status to true to stop adding the header later */
        details.responseHeaders[i].value = injectHeaders[e.name].value
        injectHeaders[e.name].injected = true
    })

    /* loop over our headers and check for any headers that haven't been injected */
    for(var header in injectHeaders){
        if(injectHeaders[header].injected) return

        /* if we haven't injected it yet, the header doesn't exist so let's add it */
        details.responseHeaders.push({
            name: header, value: injectHeaders[header].value
        })
    }

    return { responseHeaders: details.responseHeaders };
}, {urls: ['*://steamcommunity.com/*', '*://api.steampowered.com/*', '*://steamrep.com/*', '*://api.fixer.io/*']}, ['blocking', 'responseHeaders']);

chrome.webRequest.onBeforeSendHeaders.addListener(function(details){
    return { requestHeaders: [
        { name: 'Content-Type', value: 'application/x-www-form-urlencoded; charset=UTF-8' },
        { name: 'Accept', value: '*/*' },
        { name: 'Referer', value: details.url.replace('accept/st-accept', '') },
        { name: 'Accept-Language', value: 'en-US,en;q=0.8' },
        { name: 'Accept-Encoding', value: 'gzip, deflate, br' },
        { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.84 Safari/537.36' },
        { name: 'Cookie', value: headerCookies }
    ] }
}, {urls: ['*://steamcommunity.com/tradeoffer/*/accept/st-accept']}, ['blocking', 'requestHeaders']);

chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({'url': chrome.extension.getURL('settings/index.html')}, function(tab) {

    });
});

var headerCookies = []
function getAllCookies(){
    chrome.cookies.getAll({url: 'https://steamcommunity.com'}, function(cookies) {
        headerCookies = cookies.map(function(cookie){
            return cookie.name + '=' + cookie.value;
        }).join(';')
    })
}

function getAPIKey(callback){
    /* if no API key is stored locally, create one */
    chrome.storage.sync.get('apikey', function(setting){
        if(Object.keys(setting).length == 0){
            console.log('Getting Steam API Key.');
            getNewAPIKey(callback);
        } else {
            if(typeof(callback) === 'function') callback(setting.apikey);
        }
    });
}

/* get API key */
function getNewAPIKey(callback){
    chrome.cookies.get({url: 'https://steamcommunity.com', name: 'sessionid'}, function(cookie) {
        $.ajax({
            method: 'POST',
            url: 'https://steamcommunity.com/dev/registerkey',
            data: {
                domain: 'localhost',
                agreeToTerms: 'agreed',
                sessionid: cookie.value,
                submit: 'Register'
            },
            success: function(response) {
                if ($(response).find('#mainContents h2').text() === 'Access Denied') {
                    console.log('Unable to get Steam API Key.');
                }

                if($(response).find('#bodyContents_ex h2').text() === 'Your Steam Web API Key'){
                    var key = $(response).find('#bodyContents_ex p').eq(0).text().split(' ')[1];
                    console.log('Retrieved Steam API Key: ' + key);

                    if(typeof(callback) === 'function') callback(key)
                    chrome.storage.sync.set({'apikey': key});
                }
            }
        })
    });
}

var mappings = {
    notifications: { 4: 0, 5: 0, 6: 0, 7: 0 },
    names: { 4: 'comment', 5: 'item', 6: 'friend invite', 7: 'gift' },
    urls: { 4: 'commentnotifications', 5: 'inventory', 6: 'home/invites', 7: 'inventory/#pending_gifts' }
}

getNotifications()
function getNotifications(){
    $.ajax({
        url: 'https://steamcommunity.com/actions/GetNotificationCounts',
        success: function(response){
            if(!response || !response.hasOwnProperty('notifications')) return setTimeout(getNotifications, 15 * 1000);

            var notifs = response.notifications
            for(var n in notifs){
                /* x > undefined is false, which means this can only be true for the
                 notifications defined in mappings.notifications */
                if(notifs[n] > mappings.notifications[n]){
                    var count = notifs[n] - mappings.notifications[n];

                    /* set the volume of the sound before playing it */
                    chrome.storage.sync.get('volume', function(setting){
                        if(!setting.hasOwnProperty('volume')) setting.volume = 80
                        notificationSound.volume = setting.volume / 100
                        notificationSound.play();
                    })

                    chrome.notifications.create(n, {
                        type: 'basic',
                        title: 'CS:GO Trade Helper',
                        message: 'You have ' + count + ' new ' + mappings.names[n] + (count == 1 ? '' : 's'),
                        iconUrl: '/assets/notification.png'
                    });
                }
            }

            /* only keep track of the notifications we want */
            mappings.notifications = { 4: notifs[4], 5: notifs[5], 6: notifs[6], 7: notifs[7] }
            setTimeout(getNotifications, 15 * 1000)
        },
        error: function(){
            setTimeout(getNotifications, 15 * 1000);
        }
    })
}

var knownOffers = [], itemsInTrade = {};
var notificationSound = new Audio('../assets/chime.mp3');
chrome.storage.sync.get('sound', function(setting){
    if(setting.hasOwnProperty('sound')) notificationSound = new Audio('../assets/' + setting.sound + '.mp3')
})

getOffers();
function getOffers(){
    makeAPICall('https://api.steampowered.com/IEconService/GetTradeOffers/v1', {
        get_sent_offers: 1,
        get_received_offers: 1,
        get_descriptions: 0,
        active_only: 1,
        historical_only: 0
    }, function(data){
        if(data.err) return;
        data = data.data;

        /* no offers */
        if(Object.keys(data.response).length == 0) return;

        var offers = {}, players = [], tempItemsInTrade = {};
        data.response.trade_offers_received.forEach(function(offer){
            /* we only want active trade offers, even though we imply this with
             'active_only' in the request we sometimes get cancelled offers */
            if(offer.trade_offer_state != 2) return;

            /* convert steam id 3 to 64 bit */
            var steamid = toSteam64(offer.accountid_other);

            if(offer.items_to_receive){
                var theirItemsInTrade = offer.items_to_receive.map(function(item){ return item.assetid })
                if(!tempItemsInTrade.hasOwnProperty(steamid)){
                    tempItemsInTrade[steamid] = theirItemsInTrade
                } else {
                    tempItemsInTrade[steamid] = tempItemsInTrade[steamid].concat(theirItemsInTrade)
                }
            }

            if(offer.items_to_give){
                var myItemsInTrade = offer.items_to_give.map(function(item){ return item.assetid })
                if(!tempItemsInTrade.hasOwnProperty('me')){
                    tempItemsInTrade['me'] = myItemsInTrade
                } else {
                    tempItemsInTrade['me'] = tempItemsInTrade['me'].concat(myItemsInTrade)
                }
            }

            /* accept offers giving us free items */
            chrome.storage.sync.get('autoaccept', function(setting){
                if(setting.autoaccept && (!offer.items_to_give || offer.items_to_give.length == 0) ){
                    getAllCookies()
                    acceptOffer(offer.tradeofferid, steamid)
                }
            })

            /* only get incoming trade offers */
            if(!offer.is_our_offer){
                /* if we already know about this offer, skip */
                if(knownOffers.indexOf(offer.tradeofferid) > -1) return;
                knownOffers.push(offer.tradeofferid);

                /* keep track of steam ids so we can get player info */
                players.push(steamid);

                offers[steamid] = {
                    steamid: steamid,
                    id: offer.tradeofferid,
                    message: offer.message,
                    give: offer.hasOwnProperty('items_to_give') ? offer.items_to_give.length : 0,
                    receive: offer.hasOwnProperty('items_to_receive') ? offer.items_to_receive.length : 0
                }
            }
        })

        /* we make a temp store of the items
         so on every poll we keep the list updated */
        itemsInTrade = tempItemsInTrade;

        /* players will be empty if we have no new offers */
        if(players.length == 0) return setTimeout(getOffers, 1000 * 15);

        /* get all the player information */
        makeAPICall('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2', {
            steamids: players.join(',')
        }, function(data){
            if(data.err) return;
            data = data.data;

            /* loop over every player, get the blob for their profile picture and
             then display the notification */
            data.response.players.forEach(function(player){
                getBlob(player.avatarfull, function(data){
                    var offer = offers[player.steamid];

                    /* set the volume of the sound before playing it */
                    chrome.storage.sync.get('volume', function(setting){
                        if(!setting.hasOwnProperty('volume')) setting.volume = 80
                        notificationSound.volume = setting.volume / 100
                        notificationSound.play();
                    })

                    chrome.notifications.create(offer.id, {
                        type: 'basic',
                        title: 'CS:GO Trade Helper',
                        message: player.personaname + ' has sent you a trade offer!' + (offer.message.length > 0 ? '\n"' + offer.message + '"' : ''),
                        iconUrl: data.err ? '' : data.data
                    });
                })
            })

            setTimeout(getOffers, 1000 * 30);

            /*var notifications = [];
             for(var offer in offers){
             var offer = offers[offer];
             var message = '';
             if(offer.give == 0) message = 'is giving you ' + offer.receive + ' item' + (offer.receive == 1 ? '' : 's')
             if(offer.give > 0) message = 'wants ' + offer.give + ' item' + (offer.give == 1 ? '' : 's')

             notifications.push({
             title: players[offer.steamid],
             message: message
             });
             }

             chrome.notifications.create({
             type: 'list',
             title: 'You have new trade offers!',
             message: 'You have new trade offers!',
             iconUrl: 'some random blob',
             items: notifications
             }, function(id){

             });*/

        })
    })
}

function acceptOffer(id, partner){
    /* this will be an interesting statistic to see as this is only
       called when the extension auto accepts an empty trade */
    _gaq.push(['_trackEvent', 'acceptOffer', 'clicked']);

    chrome.cookies.get({url: 'https://steamcommunity.com', name: 'sessionid'}, function(cookie) {
        /* we post with 'st-accept' so we can identify this call on 'onBeforeSendHeaders'
         so we only modify headers for this call */
        $.ajax({
            type: 'POST',
            url: 'https://steamcommunity.com/tradeoffer/' + id + '/accept/st-accept',
            data: {
                sessionid: cookie.value,
                serverid: 1,
                tradeofferid: id,
                partner: partner,
                captcha: ''
            },
            crossDomain: true,
            xhrFields: { withCredentials: true }
        })
    })
}

function makeAPICall(url, data, callback){
    getAPIKey(function(key){
        data['key'] = key;
        $.ajax({
            url: url,
            data: data,
            success: function(response) {
                callback({err: false, data: response});
            },
            error: function(){
                callback({err: true});
            }
        })
    })
}

chrome.notifications.onClicked.addListener(function(id){
    if(mappings.urls[id]){
        window.open('https://steamcommunity.com/my/' + mappings.urls[id]);
    } else {
        window.open('https://steamcommunity.com/tradeoffer/' + id);
    }
});

function getBlob(url, callback) {
    /* can't fetch blobs with jQuery Ajax so we use native functions */
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function(e) {
        if(this.status != 200) return callback({err: true});

        var reader = new window.FileReader();
        reader.readAsDataURL(this.response);
        reader.onloadend = function() {
            callback({err: false, data: reader.result});
        }
    };
    xhr.send();
}

var prices = {}, rates = {};
function getPrices(callback){
    _gaq.push(['_trackEvent', 'getPrices', 'clicked']);

    var urls = {
        fast: 'https://api.csgofast.com/sih/all',
        backpack: 'https://i7xx.xyz/api/1/prices?source=backpack',
        steamlytics: 'http://api.csgo.steamlytics.xyz/v2/pricelist/compact?key=',
        bitskins: 'https://i7xx.xyz/api/1/prices?source=bitskins'
    };

    /* get settings, 'prices' is the pricing source, 'steamlytics' is the Steamlytics api key */
    chrome.storage.sync.get(['prices', 'steamlytics'], function(settings){
        var source = settings.hasOwnProperty('prices') ? settings.prices : 'backpack'
        var url = urls[source]

        if(settings.hasOwnProperty('steamlytics') && source == 'steamlytics'){
            url += settings.steamlytics
        }

        /* if we don't have an api key for steamlytics, default to backpack */
        $.ajax({
            url: url,
            success: function(response){
                if((source === 'backpack' || source == 'bitskins') && !response.success){
                    return setTimeout(getPrices.bind(null, callback), 1000)
                }

                if(source === 'steamlytics'){
                    if(!response.success) return setTimeout(getPrices.bind(null, callback), 1000 * 60 * 10)
                    else response['prices'] = response.items
                }

                callback(prices = response.prices)
            },
            error: function(){
                setTimeout(getPrices.bind(null, callback), 1000)
            }
        })
    })
}

function getRates(callback){
    $.ajax({
        url: 'https://api.fixer.io/latest?base=USD',
        success: function(response){
            /* parse it if  hasn't been parsed yet */
            callback(typeof(response) == 'string' ? JSON.parse(response) : response);
        },
        error: function(){
            setTimeout(getRates.bind(null, callback), 500)
        }
    })
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    /* requestPrices is sent by tools.js to get the price list */
    if(request.action === 'requestPrices'){
        /* if we haven't got the prices yet, request them and cache them */
        if(Object.keys(prices).length == 0){
            getPrices(sendResponse);
        } else {
            /* if we do already have them, send the cached version */
            sendResponse(prices);
        }
    } else if(request.action === 'updatePrices'){
        /* force update the prices */
        getPrices(console.log);
    } else if(request.action === 'getAPIKey'){
        getAPIKey(function(key){
            sendResponse({data: key})
        })
    } else if(request.action === 'getTradeItems'){
        var items = itemsInTrade.hasOwnProperty(request.steamID) ? itemsInTrade[request.steamID] : []
        sendResponse({items: items})
    } else if(request.action === 'getSettings'){
        chrome.storage.sync.get(function(settings){
            sendResponse({
                fvdecimals: settings.hasOwnProperty('fvdecimals') ? settings.fvdecimals : 6,
                autoaccept: settings.hasOwnProperty('autoaccept') ? settings.autoaccept : true,
                intradebg: settings.hasOwnProperty('intradebg') ? settings.intradebg : 188,
                exchangeabbr: settings.hasOwnProperty('exchangeabbr') ? settings.exchangeabbr : 'USD',
                exchangesymb: settings.hasOwnProperty('exchangesymb') ? settings.exchangesymb : '$',
                fontsizetop: settings.hasOwnProperty('fontsizetop') ? settings.fontsizetop : 12,
                fontsizebottom: settings.hasOwnProperty('fontsizebottom') ? settings.fontsizebottom : 14,
                volume: settings.hasOwnProperty('volume') ? settings.volume : 100,
                prices: settings.hasOwnProperty('prices') ? settings.prices : 'backpack',
                autoignore: settings.hasOwnProperty('autoignore') ? settings.autoignore : true,
                sound: settings.hasOwnProperty('sound') ? settings.sound : 'chime'
            })
        })
    } else if(request.action === 'getRates'){
        if(Object.keys(rates).length == 0){
            getRates(function(response){
                if(response && response.rates){
                    /* the base is not included
                     in the response, so we set it */
                    response.rates.USD = 1;
                    rates = response.rates;
                }

                sendResponse(rates)
            })
        } else {
            /* if we already have the rates, send the cached version */
            sendResponse(rates)
        }
    }

    /* this is necessary or the function becomes invalidated */
    return true;
});

function toSteam64(accountid){
    return new UINT64(accountid, (1 << 24) | (1 << 20) | (1)).toString()
}
