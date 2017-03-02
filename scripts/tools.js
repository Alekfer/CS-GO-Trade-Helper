/* http://steamcommunity.com/id/i7xx/inventory/ becomes ['', 'id', 'i7xx', 'inventory', ''] */
var path = window.location.pathname.split('/')
if(path.join('/') !== '/' && ['tradeoffer'].indexOf(path[1]) == -1 || ['chat'].indexOf(path[2]) > -1 && ['tradingcards'].indexOf(path[1]) == -1 && path.join('/').indexOf('/json/') == -1){
    /* add a nicer background and make the profile element transparent */
    $('body, .profile_header_bg_texture').css('background', 'url("http://store.akamai.steamstatic.com/public/images/v6/colored_body_top.png?v=2") center top no-repeat #1b2838')
    $('.profile_small_header_texture').css({'background-image': 'inherit', 'background-color': 'rgba(26,41,58,0.75)', 'box-shadow': '0px 0px 15px -2px black'})
    $('.profile_small_header_bg').css('background-image', 'inherit')
}

/* the 'groups' and 'home/invites' page have a background we want to make transparent,
 we also need to check for 'chat' in path[2] because the chat url is '//chat/' */
if(['allcomments', 'groups', 'home'].indexOf(path[3]) > -1){
    $('#BG_bottom').css({'background-image': 'inherit', 'background-color': 'rgba(26,41,58,0.75)'})
}

var prices = {};
chrome.runtime.sendMessage({action: 'requestPrices'}, function(response){
    prices = response;
});

var settings = {};
chrome.runtime.sendMessage({action: 'getSettings'}, function(response){
    settings = response;
})

var rates = {};
chrome.runtime.sendMessage({action: 'getRates'}, function(response){
    rates = response;
})

function formatPrice(price){
    /* convert price based on settings */
    return settings.exchangesymb + (Number(price) * rates[settings.exchangeabbr]).toFixed(2)
}

function getAPIKey(callback){
    chrome.runtime.sendMessage({action: 'getAPIKey'}, function(response){
        callback(response.data)
    })
}

function buildItemSummary(types, tradeoffer){
    /* tradeoffer = is in trade offer page */
    if(Object.keys(types).length == 0) return '';
    /* if we're in a trade offer, make the margin -2px else it's excessive */
    var summary = '<hr ' + (tradeoffer ? 'style="margin-bottom:-2px" ' : '') + 'class="st-trade-offer-divider">';
    var build = []
    for(var type in types){
        /* if we're in a trade offer, comma delimit the items to save space */
        build.push(type + ': ' + types[type])
    }
    return summary + build.join(tradeoffer ? ', ' : '<br>');
}

/* verify a steamID */
function checkVerification(steamID, callback){
    $.ajax({
        url: 'https://i7xx.xyz/api/1/verified',
        data: { steamid: steamID },
        success: callback
    })
}

/* class id to item info */
var idPairs = {};

function getInventory(steamID, callback, attempt){
    /* if the attempt argument was not provided, set it to 0 */
    if(arguments.length < 3) attempt = 0

    console.log('Loading inventory JSON for ' + steamID + ', attempt #' + (attempt + 1));

    /* if the total tries is above the threshold, stop retrying */
    if(++attempt > 3){
        if(typeof(callback) === 'function') callback(true, null, null);
        return;
    }

    /* load the inventory and parse it upon success */
    $.ajax({
        url: 'https://steamcommunity.com/profiles/' + steamID + '/inventory/json/730/2',
        success: function(response, status, xhr){
            if(!response.success){
                /* we could pass "response.error" as a parameter to this callback,
                 but it doesn't really matter - if the success is false, it usually
                 means the inventory is private or Steam is having problems */
                if(typeof(callback) === 'function') callback(true, null, null)
                return
            }

            parseInventory(steamID, response, function(infoPairs, idPairs){
                if(typeof(callback) === 'function') callback(false, infoPairs, idPairs);
            })
        },
        error: function(error){
            setTimeout(getInventory.bind(null, steamID, callback, attempt), 2000)
        }
    });
}

function parseInventory(steamID, response, callback){
    /* wait until the prices have loaded, we could do this earlier but to
     speed things up we get the inventory first and wait for prices before
     we parse it */
    if(Object.keys(prices).length == 0) return setTimeout(parseInventory.bind(null, steamID, response, callback), 500);

    /* loop over descriptions, match 'classid_instanceid' to item name */
    for(var id in response.rgDescriptions){
        var item = response.rgDescriptions[id];
        /* replace special characters to ensure compatibility with price list */
        //item.market_hash_name = item.market_hash_name.replace('\u2122 ', '™').replace('\u2605 ', '★');

        /* sometimes Steam goes weird and we don't have the right attributes,
         we could retry, but it'd be easier for now to just skip the item */
        if(!item || !item.market_hash_name) continue;

        /* search the tags for the wear */
        var wear = 'V', type = 'Unknown';
        item.tags.forEach(function(tag){
            /* sometimes that tag is `name` and sometimes it's `localized_tag_name` depending on the context from where
             the information came (e.g. from g_ActiveInventory or /inventory/json) */
            if(tag.category == 'Exterior'){
                if(tag.localized_tag_name) wear = tag.localized_tag_name.replace(/[-a-z ]/g, '');
                if(tag.name) wear = tag.name.replace(/[-a-z ]/g, '');
            }

            if(tag.category == 'Type'){
                if(tag.localized_tag_name) type = tag.localized_tag_name;
                if(tag.name) type = tag.name;
            }
        })

        /* if it's not painted, change it to vanilla */
        if(wear === 'NP') wear = 'V';

        /* find the stickers */
        var stickers = [];
        item.descriptions.forEach(function(desc){
            if(desc.value.indexOf('Sticker Details') == -1) return;

            $(desc.value).find('img').each(function(){
                stickers.push($(this).attr('src'));
            })
        })

        idPairs[item.classid + '_' + item.instanceid] = {
            /* clear out the stattrak part so we can match it to the name in patterns.js */
            name: item.name.replace('StatTrak\u2122 ', ''),
            price: Number(prices[item.market_hash_name]),
            wear: wear,
            color: item.name_color,
            tradable: item.tradable,
            img: item.icon_url,
            type: type,
            stickers: stickers,
            inspect: item.actions && item.actions.length == 1 ? item.actions[0].link.replace('%owner_steamid%', steamID) : null
        };
    }

    /* loop over inventory, match 'assetid' to the item in idPairs */
    var infoPairs = {};
    for(var id in response.rgInventory){
        var item = response.rgInventory[id];

        /* sometimes we just won't get any item here, not sure why, haven't
         been able to reproduce, so let's just skip over */
        if(!item || !item.id) continue;

        idPairs[item.classid + '_' + item.instanceid]['id'] = item.id
        var inspect = idPairs[item.classid + '_' + item.instanceid].inspect
        if(inspect){
            idPairs[item.classid + '_' + item.instanceid].inspect = inspect.replace('%assetid%', item.id)

            /*$.ajax({
             url: 'http://localhost:3000/api/1/',
             data: { url: inspect },
             success: function(response) {
             //console.log({err: false, data: response});
             }, error: function(){
             //console.log({err: true})
             }
             })*/
        }

        infoPairs[item.id] = idPairs[item.classid + '_' + item.instanceid];
    }

    callback(infoPairs, idPairs)
}

/* formats the percentage/pattern for the overlay */
function formatPattern(name, seed){
    name = name.replace('StatTrak\u2122 ', '').replace('StatTrak™ ', '');
    if(!patterns[name] || !patterns[name][seed]) return '';

    if(name.indexOf('Case Hardened') == -1){
        /* it's a fade.. */
        return ' ' + patterns[name][seed] + '%';
    }

    var weirdSchema = name.indexOf('AK-47') == -1 && name.indexOf('Five-SeveN') == -1;
    return (weirdSchema ? '<br>' : ' ') + patterns[name][seed];
}

function isOfferGlitched(offerID, callback){
    makeAPICall('https://api.steampowered.com/IEconService/GetTradeOffer/v1/', {
        language: '',
        tradeofferid: offerID
    }, function(response){
        if(response.err) return callback(false)
        if(!response.descriptions) return callback(true)

        /* array of class ids, we do this to check if the items we loop over in the offer
         are in the descriptions as glitched items do not appear in the descriptions */
        var descriptions = response.descriptions.map(function(item){ return item.classid })

        var glitched = response.offer.items_to_give.concat(response.offer.items_to_receive).some(function(item){
            if(descriptions.indexOf(item.classid) == -1) return true
        })

        callback(glitched)
    })
}

var phases = {
    'Sapphire': 'Sphr',
    'Ruby': 'Ruby',
    'Phase 1': 'P1',
    'Phase 2': 'P2',
    'Phase 3': 'P3',
    'Phase 4': 'P4',
    'Emerald': 'Emrl',
    'Black Pearl': 'BP'
}

function getInventoryDetails(steamID, callback, attempt){
    $.ajax({
        url: '//csgo.exchange/inventoryapi/1/' + steamID,
        success: function(response){
            if(!response || response.error || !response.steamid || !response.inventory){
                callback(null, attempt + 1);
                return setTimeout(function(){
                    getInventoryDetails(steamID, callback, attempt + 1);
                }, 400);
            }

            var items = {};
            for(var item in response.inventory){
                var item = response.inventory[item];

                /* if we don't have the float, don't bother overlaying the info on items */
                if(!item.float) continue;
                var float = String(item.float).substr(0, settings.fvdecimals + 2);
                items[item.id] = { float: float, seed: item.texture || -1 }
                if(item.doppler && item.doppler.name) items[item.id].phase = phases[item.doppler.name]
            }

            callback(items, attempt);
        },
        error: function(){
            callback(null, attempt + 1)
            setTimeout(function(){
                getInventoryDetails(steamID, callback, attempt + 1);
            }, 2000);
        }
    });
}

function replicateSteamResponse(data){
    var invToParse = { rgInventory: {}, rgDescriptions: {} }

    /* parseInventory function was designed to work with JSON responses from Steam,
     instead of reworking the whole function we just replicate the rg_ActiveInventory information
     and pretend it's a Steam response, not ideal but it works */
    for(var id in data.inventory){
        var item = data.inventory[id]

        invToParse.rgInventory[id] = {
            id: id, classid: item.classid, instanceid: item.instanceid
        }

        invToParse.rgDescriptions[id + '_' + item.instanceid] = item
    }

    return invToParse;
}

/* make api calls */
function makeAPICall(url, data, callback){
    getAPIKey(continueCall);

    function continueCall(key){
        data.key = key;
        $.ajax({
            url: url,
            data: data,
            success: function(response) {
                callback({err: false, data: response});
            }, error: function() {
                callback({err: true})
            }
        })
    }
}

/* if the tradeoffer boolean is true, it means we're on a trade offer page
 and need to get their steamID through a different variable */
function getSteamID(mine, callback, tradeoffer){
    injectScriptWithEvent({ '\'%%steamID%%\'': mine ? 'g_steamID' : tradeoffer ? 'g_ulTradePartnerSteamID' : 'UserYou.strSteamId' }, function(){
        window.dispatchEvent(new CustomEvent('%%event%%', {
            detail: '%%steamID%%'
        }));
    }, callback)
}

/* we want to manipulate items in the trade offer, so we need to make a script and
 insert it to call Steam functions */
function addItemToTrade(elementID){
    injectScript({ '\'%%rgItem%%\'': 'jQuery("#' + elementID + '")[0].rgItem' }, function(){
        FindSlotAndSetItem('%%rgItem%%')
    })
}

/* same as above, but for removing items */
function removeItemFromTrade(elementID){
    injectScript({ '\'%%rgItem%%\'': 'jQuery("#' + elementID + '")[0].rgItem' }, function(){
        RevertItem('%%rgItem%%')
    })
}

/* inTradeOffer, boolean, true when in trade offer page */
function editActionMenu(inTradeOffer, steamID){
    injectScript({ '%%steamID%%': steamID, '%%steamID%%': steamID }, function(){
        /* bit of a hacky solution, but we need to do two seperate selections
         and iterations due to the html structure of items within the inventory
         and the actual trade offer items */

        $J('.itemHolder:not(.trade_slot)').each(function(){
            /* length will only be one if there is no item there */
            if($J(this).children().length == 1) return;

            var item = $J(this)[0].rgItem;
            if(item && item.actions){
                if(item.actions.some(function(item){ return item.name === 'View on Exchange...' || item.name === 'View on Metjm...'})) return;
                $J(this)[0].rgItem.actions.push({link: 'https://csgo.exchange/item/' + item.id, name: 'View on Exchange...'});

                var inspect = item.actions[0].link.replace('%owner_steamid%', '%%steamID%%').replace('%assetid%', item.id)
                $J(this)[0].rgItem.actions.push({link: 'https://metjm.net/extensionLink.php?inspectlink=' + inspect, name: 'View on Metjm...'})
            }
        })

        $J('.slot_inner .item.app730:not(.pendingItem)').each(function(){
            var item = $J(this)[0].rgItem;
            if(item && item.actions){
                if(item.actions.some(function(item){ return item.name === 'View on Exchange...' || item.name === 'View on Metjm...'})) return;
                $J(this)[0].rgItem.actions.push({link: 'https://csgo.exchange/item/' + item.id, name: 'View on Exchange...'});

                var inspect = item.actions[0].link.replace('%owner_steamid%', '%%steamID%%').replace('%assetid%', item.id)
                $J(this)[0].rgItem.actions.push({link: 'https://metjm.net/extensionLink.php?inspectlink=' + inspect, name: 'View on Metjm...'})
            }
        })
    })
}

function injectScript(args, source){
    /* stringify our function */
    source = source.toString()

    /* insert all of our arguments into the script */
    for(var arg in args)
        source = source.replace(arg, args[arg])

    /* inject and remove the script */
    var script = document.createElement('script');
    script.textContent = '(' + source + ')();';
    document.body.appendChild(script)
    script.parentNode.removeChild(script)
}

function injectScriptWithEvent(args, source, callback){
    /* generate a random event name and insert it into the source */
    var eventID = String(Math.floor(Math.random() * 10000))
    source = source.toString().replace('%%event%%', eventID)

    /* insert all of our arguments into the script */
    for(var arg in args)
        source = source.replace(arg, args[arg])

    /* set up the event listener to invoke the callback */
    $(window).on(eventID, function(event){
        callback(event.originalEvent.detail)
    })

    /* inject and remove the script */
    var script = document.createElement('script');
    script.textContent = '(' + source + ')();';
    document.body.appendChild(script)
    script.parentNode.removeChild(script)
}

/* this function is used as a callback for injectScriptWithEvent - a script is injected
   to insert an event emitter into certain functions (functions that build the item hovers,
   item info element on inventory page) and when the emit emits this callback will
   look for the 'sticker_info' element, get sticker prices and replace the html */
function stickerPriceCallback(id){
    if(!id) return
    var stickerElement = $('#' + id).find('#sticker_info')

    /* the #sticker_info element will not exist if the item has no stickers */
    if(stickerElement.html() == undefined) return

    /* stickerElement.text() will return something like the line below:
     "Sticker: NBK- | Cologne 2016, dennis | MLG Columbus 2016"
     the manipulation seen below for newStickerInfo will return an array with the sticker names:
     ['NBK- | Cologne 2016', 'dennis | MLG Columbus 2016']
     we then loop over each sticker, build up the pricing html and replace the existing html */

    var total = 0
    var newStickerInfo = stickerElement.text().split(': ')[1].split(', ').map(function(name){
        var price = prices["Sticker | " + name]
        total += Number(price)
        /* will return: '<br>Cerberus $1.05' */
        return "<br>" + name + " " + formatPrice(price)
    })
    newStickerInfo.push('<hr>Total: ' + formatPrice(total))
    stickerElement.html(stickerElement.html().replace(stickerElement.text(), newStickerInfo.join("")))

}

function getCookie(name) {
    var parts = ('; ' + document.cookie).split('; ' + name + '=');
    if (parts.length == 2) return parts.pop().split(';').shift();
}

function toSteam64(accountid){
    return new UINT64(accountid, (1 << 24) | (1 << 20) | (1)).toString()
}
