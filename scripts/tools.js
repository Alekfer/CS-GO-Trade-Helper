function modernise(){
  $('body').css('background', 'url("http://store.akamai.steamstatic.com/public/images/v6/colored_body_top.png?v=2") center top no-repeat #1b2838')
  $('.profile_small_header_texture').css({'background-image': 'inherit', 'background-color': 'rgba(26,41,58,0.75)', 'box-shadow': '0px 0px 15px -2px black'})
  $('.profile_small_header_bg').css('background-image', 'inherit')
}

if(window.location.pathname.indexOf('/chat/') > -1) modernise()

var prices = {};
requestPrices();

function requestPrices(){
  chrome.runtime.sendMessage({action: 'requestPrices'}, function(response){
    if(response === undefined || response.err) return setTimeout(requestPrices, 1000);
    prices = response.data;
  });
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


/* class id to item info */
var idPairs = {};

function getInventory(url, steamID, successCallback, errorCallback, attempt){
  /* if the attempt argument was not provided, set it to 0 */
  if(arguments.length < 5) attempt = 0

  console.log('Loading inventory JSON for ' + url + ', attempt #' + (attempt + 1));

  /* if the total tries is above the threshold, stop retrying */
  if(++attempt > 3){
    if(typeof(errorCallback) === 'function') errorCallback();
    return;
  }

  /* load the inventory and parse it upon success */
  $.ajax({
    url: url + (url.indexOf('inventory') > -1 ? '' : '/inventory') + (url.indexOf('json') > -1 ? '' : '/json/730/2'),
    success: function(response){
      parseResponse();
      function parseResponse(){
        /* wait until the prices have loaded, we could do this earlier but to
           speed things up we get the inventory first and wait for prices before
           we parse it */
        if(Object.keys(prices).length == 0) return setTimeout(parseResponse, 500);

        /* loop over descriptions, match 'classid_instanceid' to item name */
        for(var id in response.rgDescriptions){
          var item = response.rgDescriptions[id];
          /* replace special characters to ensure compatibility with price list */
          if(!item.market_hash_name) console.log(item, id)
          item.market_hash_name = item.market_hash_name.replace('\u2122', '™').replace('\u2605', '★');

          /* search the tags for the wear */
          var wear = 'V', type = 'Unknown';
          item.tags.forEach(function(tag){
            if(tag.category == 'Exterior') wear = tag.name.replace(/[-a-z ]/g, '');
            if(tag.category == 'Type') type = tag.name;
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
            name: item.name.replace('StatTrak\u2122', ''),
            price: prices[item.market_hash_name],
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

          idPairs[item.classid + '_' + item.instanceid]['id'] = id
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

        if(typeof(successCallback) === 'function') successCallback(infoPairs, idPairs);
      }
    },
    error: function(error){
      console.log(error)
      if(typeof(errorCallback) === 'function') errorCallback()
    }
  });
}

function getCookie(name) {
  var parts = ('; ' + document.cookie).split('; ' + name + '=');
  if (parts.length == 2) return parts.pop().split(';').shift();
}

/* formats the percentage/pattern for the overlay */
function formatPattern(name, seed){
  name = name.replace('StatTrak\u2122 ', '');
  if(!patterns[name] || !patterns[name][seed]) return '';

  if(name.indexOf('Case Hardened') == -1){
    /* it's a fade.. */
    return ' ' + patterns[name][seed] + '%';
  }

  var weirdSchema = name.indexOf('AK-47') == -1 && name.indexOf('Five-SeveN') == -1;

  return (weirdSchema ? '<br>' : ' ') + patterns[name][seed];
}

function getAPIKey(callback){
  /* if no API key is stored locally, create one */
  chrome.storage.sync.get('apikey', function(items){
    if(Object.keys(items).length == 0){
      console.log('Getting Steam API Key.');
      getNewAPIKey();
    } else {
      if(typeof(callback) === 'function') callback(items['apikey']);
    }
  });
}

/* we run this to quickly ensure that the user has a key */
getAPIKey();

/* get API key */
function getNewAPIKey(){
  $.ajax({
    method: 'POST',
    url: '/dev/registerkey',
    data: {
      domain: 'localhost',
      agreeToTerms: 'agreed',
      sessionid: getCookie('sessionid'),
      submit: 'Register'
    },
    success: function(response) {
      if ($(response).find('#mainContents h2').text() === 'Access Denied') {
        console.log('Unable to get Steam API Key.');
      }

      if($(response).find('#bodyContents_ex h2').text() === 'Your Steam Web API Key'){
        var key = $(msg).find('#bodyContents_ex p').eq(0).text().split(' ')[1];
        console.log('Retrieved Steam API Key: ' + key);

        chrome.storage.sync.set({'apikey': key});
      }
    }
  })
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

var paintIndexes = {
  415: 'Rby',
  416: 'Sph',
  417: 'BP',
  418: 'P1',
  419: 'P2',
  420: 'P3',
  421: 'P4'
}

function getInventoryDetails(steamID, callback, attempt){
  makeAPICall('https://api.steampowered.com/IEconItems_730/GetPlayerItems/v0001/', {
    SteamID: steamID
  }, function(response){
    if(response.err){
      callback(false, attempt + 1);
      return setTimeout(function(){
        getInventoryDetails(steamID, callback, attempt + 1);
      }, 400);
    }

    response = response.data;

    if(!response || !response.result || !response.result.status == 1){
      callback(false, attempt + 1);
      return setTimeout(function(){
        getInventoryDetails(steamID, callback, attempt + 1);
      }, 400);
    }

    var items = {};
    response.result.items.forEach(function(item){
      if(!item.attributes) return;

      var float = phase = seed = -1;
      for(var i = 0; i < item.attributes.length; i++){
        if(item.attributes[i].defindex == 8){
          float = item.attributes[i].float_value;
        }

        if(item.attributes[i].defindex == 7){
          seed = Math.floor(item.attributes[i].float_value);
        }

        if(item.attributes[i].defindex == 6){
          phase = item.attributes[i].float_value;
        }
      }

      /* if we don't have the float, don't bother overlaying the info on items */
      if(float == -1) return;

      items[item.id] = {
        float: float, seed: seed, phase: {name: paintIndexes[phase], phase: phase}
      };
    });

    callback(items, attempt);
  });
}

/* if the tradeoffer boolean is true, it means we're on a trade offer page
   and need to get their steamID through a different variable */
function getSteamID(mine, callback, tradeoffer){
  /* random id to stop event confusion */
  var id = String(Math.random () * 1000).substr(0, 3);

  /* set up event listener for steam id */
  window.addEventListener('steamID' + id, function (e) {
    callback(e.detail);
  });

  /* create script that will emit the steam id */
  var script = document.createElement('script');
  script.textContent = '(' + function () {
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('steamID%%id%%', true, true, '%%steamIDVariable%%');
    window.dispatchEvent(evt); } + ')();';

  script.textContent = script.textContent.replace('\'%%steamIDVariable%%\'', mine ? 'g_steamID' : tradeoffer ? 'g_ulTradePartnerSteamID' : 'UserYou.strSteamId');
  script.textContent = script.textContent.replace('%%id%%', id);

  document.body.appendChild(script);
  script.parentNode.removeChild(script);
}

/* we want to manipulate items in the trade offer, so we need to make a script and
   insert it to call Steam functions */
function addItemToTrade(elementID){
  var script = document.createElement('script');
  script.textContent = '(' + function () {
    FindSlotAndSetItem('%%rgItem%%')
  } + ')();';

  script.textContent = script.textContent.replace('\'%%rgItem%%\'', 'jQuery("#' + elementID + '")[0].rgItem');

  document.body.appendChild(script);
  script.parentNode.removeChild(script);
}

/* same as above, but for removing items */
function removeItemFromTrade(elementID){
  var script = document.createElement('script');
  script.textContent = '(' + function () {
    RevertItem('%%rgItem%%')
  } + ')();';

  script.textContent = script.textContent.replace('\'%%rgItem%%\'', 'jQuery("#' + elementID + '")[0].rgItem');

  document.body.appendChild(script);
  script.parentNode.removeChild(script);
}

/* make api calls */
function makeAPICall(url, data, callback){
  getAPIKey(continueCall);

  function continueCall(key){
    data['key'] = key;
    $.ajax({
      url: url,
      data: data,
      success: function(response) {
        callback({err: false, data: response});
      }, error: function(){
        callback({err: true}
      )}
    })

    /* random id to stop event confusion */
    /*var id = String(Math.random () * 1000).substr(0, 3);

    /* set up event listener for steam id */
    /*window.addEventListener('apiCall' + id, function (e) {
      callback(e.detail);
    });

    var script = document.createElement('script');
    script.textContent = '(' + function () {
      $J.ajax({
          url: 'http://cors.io/?u=%%url%%',
          data: '%%data%%',
          success: function (data) {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('apiCall%%id%%', true, true, {err: false, data: data});
            window.dispatchEvent(evt);
          },
          error: function () {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('apiCall%%id%%', true, true, {err: true});
            window.dispatchEvent(evt);
          }
      });
    } + ')();';

    data['key'] = key;
    script.textContent = script.textContent.replace('\'%%data%%\'', JSON.stringify(data))
    script.textContent = script.textContent.replace('%%url%%', url);
    script.textContent = script.textContent.replace('%%id%%', id).replace('%%id%%', id);

    document.body.appendChild(script);
    script.parentNode.removeChild(script);*/

  }
}
