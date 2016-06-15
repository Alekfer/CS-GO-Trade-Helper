chrome.webRequest.onHeadersReceived.addListener(function(details){
    details.responseHeaders.push({ name: 'Access-Control-Allow-Origin', value: '*' });
    return { responseHeaders: details.responseHeaders };
}, {urls: ['*://csgoapi.xyz/*', '*://api.steampowered.com/*', '*://steamrep.com/*']}, ['blocking', 'responseHeaders']);

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.create({'url': chrome.extension.getURL('settings/index.html')}, function(tab) {

  });
});

function getAPIKey(callback){
  /* if no API key is stored locally, create one */
  chrome.storage.sync.get('apikey', function(items){
    if(Object.keys(items).length == 0){
      console.log('Getting Steam API Key.');
      getNewAPIKey(callback);
    } else {
      if(typeof(callback) === 'function') callback(items['apikey']);
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
    url: 'http://steamcommunity.com/actions/GetNotificationCounts',
    success: function(response){
      if(!response || !response.hasOwnProperty('notifications')) return setTimeout(getNotifications, 15 * 1000);

      var notifs = response.notifications
      for(var n in notifs){
        /* x > undefined is alse, which means this can only be true for the
           notifications defined in mappings.notifications */
        if(notifs[n] > mappings.notifications[n]){
          var count = notifs[n];

          chrome.notifications.create(n, {
            type: 'basic',
            title: 'CS:GO Trade Helper',
            message: 'You have ' + count + ' new ' + mappings.names[n] + (count == 1 ? '' : 's'),
            iconUrl: 'notification.png'
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
var newOfferSound = new Audio('../lib/offer.mp3');
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

    var offers = {}, players = [];
    data.response.trade_offers_received.forEach(function(offer){
      /* we only want active trade offers, even though we imply this with
         'active_only' in the request we sometimes get cancelled offers */
      if(offer.trade_offer_state != 2) return;

      /* convert steam id 3 to 64 bit */
      var steamid = toSteam64(offer.accountid_other);

      if(offer.items_to_receive){
        var theirItemsInTrade =  offer.items_to_receive.map(function(item){ return item.assetid })
        if(!itemsInTrade.hasOwnProperty(steamid)){
          itemsInTrade[steamid] = theirItemsInTrade
        } else {
          itemsInTrade[steamid] = itemsInTrade[steamid].concat(theirItemsInTrade)
        }
      }

      if(offer.items_to_give){
        var myItemsInTrade =  offer.items_to_give.map(function(item){ return item.assetid })
        if(!itemsInTrade.hasOwnProperty('me')){
          itemsInTrade['me'] = myItemsInTrade
        } else {
          itemsInTrade['me'] = itemsInTrade[steamid].concat(myItemsInTrade)
        }
      }

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

    /* players will be empty if we have no new offers */
    if(players.length == 0) return setTimeout(getOffers, 1000 * 15);

    /* get all the player informations */
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
          newOfferSound.play();

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
    window.open('https://steamcommunity.com/id/me/' + mappings.urls[id]);
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

var prices = {};
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  /* requestPrices is sent by tools.js to get the price list */
  if(request.action === 'requestPrices'){
    /* if we haven't got the prices yet, request them and cache them */
    if(Object.keys(prices).length == 0){
      $.ajax({
        url: 'https://steam.expert/api/items/all/730',
        success: function(response){
          var temp = {};
          response.data.forEach(function(item){
            temp[item.market_hash_name] = item.median_month;
          })

          sendResponse({err: false, data: prices = temp});
        },
        error: function(){
          sendResponse({err: true});
        }
      })
    } else {
      /* if we do already have them, send the cached version */
      sendResponse({err: false, data: prices});
    }
  } else if(request.action === 'getAPIKey'){
    getAPIKey(function(key){
      sendResponse({data: key})
    })
  }

  /* this is necessary or the function becomes invalidated */
  return true;
});

function toSteam64(accountid){
  return new UINT64(accountid, (1 << 24) | (1 << 20) | (1)).toString()
}
