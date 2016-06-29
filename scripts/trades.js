/* todo: use g_ActiveInventory.rgInventory to load inventory items and use
   g_ActiveInventory.rgItemElements to get the elements instead of filtering manually,
   using rgInventory will increase loading times dramatically as it'll save an ajax
   request, and rgItemElements will improve accuracy and is just better practise */

$('#nonresponsivetrade_itemfilters').before(
  '<div class="trade_rule selectableNone trade_responsive_hidden"></div>' +
  '<span id="st-load-prices" style="margin-left:0" class="st-log-msg">Loading prices...</span><br>' +
  '<span id="st-load-my-floats" style="margin-left:0" class="st-log-msg">Loading my floats: attempt #0</span><br>' +
  '<span id="st-load-partner-floats" style="margin-left:0" class="st-log-msg">Loading partner floats: attempt #0</span>'
);

$('#trade_area').before(
  '<div class="st-trade-offer-box"><a id="st-sort-price" class="btn_darkblue_white_innerfade btn_medium new_trade_offer_btn"><span>Sort by Price</span></a>' +
  '<a style="margin-left:10px" id="st-sort-float" class="btn_darkblue_white_innerfade btn_medium new_trade_offer_btn"><span>Sort by Float</span></a></div>'
);

$('#trade_yours .offerheader').after(
  '<div class="st-trade-offer-totals"><span id="st-my-price">' + formatPrice(0) + '</span><span id="st-my-items" class="st-display-right">0 items</span><span style="font-size: 16px" id="st-my-types"></span></div>'
);

$('#trade_theirs .offerheader').after(
  '<div class="st-trade-offer-totals"><span id="st-their-price">' + formatPrice(0) + '</span><span id="st-their-items" class="st-display-right">0 items</span><span style="font-size: 16px" id="st-their-types"></span></div>'
);

setInterval(function(){
  var total = {
    mine:   { items: 0, price: 0, types: {} },
    theirs: { items: 0, price: 0, types: {} }
  };

  $('#your_slots .item.app730.context2').each(function(){
    total.mine.items += 1;
    if($(this).data('st-price')){
      total.mine.price += $(this).data('st-price');
    }

    if(!$(this).data('st-type')) return;
    if(!total.mine.types[$(this).data('st-type')]){
      total.mine.types[$(this).data('st-type')] = 1;
    } else {
      total.mine.types[$(this).data('st-type')] += 1;
    }
  })

  $('#st-my-types').html(buildItemSummary(total.mine.types, true));
  $('#st-my-price').text(formatPrice(total.mine.price));
  $('#st-my-items').text(total.mine.items + (total.mine.items == 1 ? ' item' : ' items'));

  /* */

  $('#their_slots .item.app730.context2').each(function(){
    total.theirs.items += 1;
    if($(this).data('st-price')){
      total.theirs.price += $(this).data('st-price');
    }

    if(!$(this).data('st-type')) return;
    if(!total.theirs.types[$(this).data('st-type')]){
      total.theirs.types[$(this).data('st-type')] = 1;
    } else {
      total.theirs.types[$(this).data('st-type')] += 1;
    }
  })

  $('#st-their-types').html(buildItemSummary(total.theirs.types, true));
  $('#st-their-price').text(formatPrice(total.theirs.price));
  $('#st-their-items').text(total.theirs.items + (total.theirs.items == 1 ? ' item' : ' items'));
}, 350);

var inventories = {
  infoPairs: {},
  details: {},
  itemsInTrade: {},
  errorLoadingInv: {}
};

/* get my inventory */
getSteamID(true, function(steamID){
  chrome.runtime.sendMessage({action: 'getTradeItems', steamID: 'me'}, function(response){
    inventories.itemsInTrade['me'] = response.items;
  });

  getInventory(steamID, function(error, infoPairs, idPairs){
    inventories.infoPairs[steamID] = infoPairs;

    inventories.errorLoadingInv[steamID] = error;
    if(error){
      $('#st-load-prices').text('Error: unable to load your inventory.');
    } else {
      loadPricesFor(steamID, true);
    }
  });

  getInventoryDetails(steamID, function(details, attempt){
    if(!details){
      return $('#st-load-my-floats').text('Loading my floats: attempt #' + attempt);
    }

    $('#st-load-my-floats').text('Loaded my floats successfully...');
    inventories.details[steamID] = details;
    populateDetails(steamID, true);
  }, 0)
}, true);

/* get their inventory */
getSteamID(false, function(steamID){
  chrome.runtime.sendMessage({action: 'getTradeItems', steamID: steamID}, function(response){
    inventories.itemsInTrade[steamID] = response.items;
  });

  getInventory(steamID, function(error, infoPairs, idPairs){
    inventories.infoPairs[steamID] = infoPairs;

    inventories.errorLoadingInv[steamID] = error;
    if(error){
      $('#st-load-prices').text('Error: unable to load partner\'s inventory.');
    } else {
      loadPricesFor(steamID, false);
    }
  });

  getInventoryDetails(steamID, function(details, attempt){
    if(!details){
      return $('#st-load-partner-floats').text('Loading partner floats: attempt #' + attempt);
    }

    $('#st-load-partner-floats').text('Loaded partner floats successfully...');
    inventories.details[steamID] = details;
    populateDetails(steamID, false);
  }, 0)
}, true);

function populateDetails(steamID, isMyItems){
  /* if we haven't loaded this inventory yet, just wait */
  if(!inventories.infoPairs.hasOwnProperty(steamID)) return setTimeout(populateDetails.bind(null, steamID, isMyItems), 750);

  /* if we've not already done so, add details to the items inside the trade offer
     and then set the meta data property to stop repeatingly adding them as this
     function (populateDetails) is recursively called */
  var itemsInOffer = '#' + (isMyItems ? 'your_slots' : 'their_slots');
  /*  make sure that the items have loaded in, and there are no loading items in the trade offer */
  if(!$(itemsInOffer).data('st-loaded-floats') &&
        $(itemsInOffer + ' .item.app730.context2').length > 0 && $(itemsInOffer + '.item.unknownItem').length == 0){

    $(itemsInOffer + ' .item.app730.context2').each(addItemDetails);
    $(itemsInOffer).data('st-loaded-floats', true);
  }

  whenInventoryLoads(steamID, function(){
    if(Object.keys(inventories.infoPairs[steamID]).length == 0 && !inventories.errorLoadingInv[steamID]) return setTimeout(populateDetails.bind(null, steamID, isMyItems), 100)

    /* populate each item and then animate them to fade in when the inventory loads */
    $('.item.app730.context2').each(addItemDetails)
    $('.st-item-float').hide().fadeIn();
  })


  function addItemDetails(){
    if(!$(this).attr('id') || $(this).data('st-loaded-floats')) return;

    var id = $(this).attr('id').split('item730_2_')[1];

    /* if we have no details for this item, set the float to max (will not be displayed)*/
    if(!inventories.details[steamID][id]) return $(this).data('st-float', -1);

    /* round the float to 5 decimal places */
    var text = inventories.details[steamID][id].float;

    /* add the float to the metadata for this element */
    $(this).data('st-float', text);

    /* add pattern information (e.g. fade percentage) */
    if(inventories.details[steamID][id].phase){
      text += ' ' + inventories.details[steamID][id].phase;
    }

    if(inventories.details[steamID][id].seed && inventories.infoPairs[steamID][id]){
      text += formatPattern(inventories.infoPairs[steamID][id].name, inventories.details[steamID][id].seed);
    }

    /* pull the fraud warning icon down a bit to make space for our overlay */
    $(this).find('.slot_app_fraudwarning').css('margin-top', '15px');

    $(this).append('<span style="font-size: ' + settings.fontsizetop + 'px" class="st-item-float">' + text + '</span>');
    $(this).data('st-loaded-floats', true);
  }
}

var sort = {
  asc: false,
  byPrice: true
}

function sortItems(a, b){
  var attrOne = $(a).find('.item.app730.context2').eq(0).data(sort.byPrice ? 'st-price' : 'st-float');
  var attrTwo = $(b).find('.item.app730.context2').eq(0).data(sort.byPrice ? 'st-price' : 'st-float');

  /* if the attribute is -1 it means we have no float value, so adjust the metadata
  float value to ensure that these items with no value always sink to the bottom */
  if(attrOne == -1) sort.asc ? attrOne = 1 : attrOne = 0;
  if(attrTwo == -1) sort.asc ? attrTwo = 1 : attrTwo = 0;

  return sort.asc ? attrOne - attrTwo : attrTwo - attrOne;
}

function loadPricesFor(steamID, isMyItems){
  /* if we have loaded both our inventories and it says we're still loading the prices,
     set up the buttons inside the trade offer and say we've loaded the prices */
  if(Object.keys(inventories.infoPairs).length == 2 && $('#st-load-prices').text() == 'Loading prices...'){
    $('#st-load-prices').text('Successfully loaded prices!');

    $('#nonresponsivetrade_itemfilters').before(
      '<br><br><a id="st-take-all" class="btn_darkblue_white_innerfade btn_medium new_trade_offer_btn"><span>Take All</span></a>' +
      '<a id="st-take-keys" style="margin-left:10px" class="btn_darkblue_white_innerfade btn_medium new_trade_offer_btn"><span>Take Keys</span></a>' +
      '<div class="st-trade-offer-input"><input class="filter_search_box" type="text" id="st-key-count" value="" placeholder="# of Keys" name="filter" autocomplete="off" onkeypress="return event.charCode >= 48 && event.charCode <= 57"></div>'
    );

    $('#st-take-all').click(function(){
      $('.inventory_page').each(function(){
        if($(this).css('display') === 'none' || $(this).parent().css('display') === 'none') return;

        $(this).find('.item.app730.context2').each(function(){
          /* we check if it's visible, if it's not it means the user is filtering items */
          if($(this).parent().css('display') !== 'none') addItemToTrade($(this).attr('id'));
        })
      })
    });

    $('#st-take-keys').click(function(){
      /* get the number of keys the user wants, if it's not a number set it to
        -1 which means take all the keys on the page */
      var keysLeft = $('#st-key-count').val();
      if(isNaN(keysLeft) || !keysLeft) keysLeft = -1;

      $('.inventory_page').each(function(){
        /* if we want to take all the keys on the page, only take the keys that
           are on the displayed page, we also make sure that the inventory_page
            and the parent (the player's entire inventory) is visible to ensure
            we are taking items from the correct inventory */
        if((keysLeft == -1 && $(this).css('display') === 'none' || $(this).parent().css('display') === 'none') ||
          (keysLeft != -1 && $(this).parent().css('display') === 'none')) return;

        var steamID = $(this).parent().attr('id').split('_')[1];

        $(this).find('.item.app730.context2').each(function(){
          /* id is stored as item730_2_6378488731, so we split to get assetid and
             check if it's a key, if it is we add it to the trade */
          var id = $(this).attr('id');
          if(inventories.infoPairs[steamID][id.split('_')[2]].type !== 'Key') return;

          /* if we want to get all the keys on the page, or we still have keys
             to get, then add them and take one away from the keys to get if
             we want to get a certain amount */
          if(keysLeft == -1 || keysLeft > 0){
            /* we check if it's visible, if it's not it means the user is filtering items */
            if($(this).parent().css('display') !== 'none') addItemToTrade(id);
            if(keysLeft != -1) keysLeft--;
          }
        })
      })
    })


    $('#st-sort-price').click(function(){
      sort.byPrice = true;
      $('#your_slots .itemHolder.has_item').sort(sortItems).prependTo('#your_slots');
      $('#their_slots .itemHolder.has_item').sort(sortItems).prependTo('#their_slots');

      sort.asc = !sort.asc;
    })

    $('#st-sort-float').click(function(){
      sort.byPrice = false;
      $('#your_slots .itemHolder.has_item').sort(sortItems).prependTo('#your_slots');
      $('#their_slots .itemHolder.has_item').sort(sortItems).prependTo('#their_slots');

      sort.asc = !sort.asc;
    })
  }

  /* if we've not already done so, add details to the items inside the trade offer
     and then set the meta data property to stop repeatingly adding them as this
     function (loadPricesFor) is recursively called */
  var itemsInOffer = '#' + (isMyItems ? 'your_slots' : 'their_slots');
  /*  make sure that the items have loaded in, and there are no loading items in the trade offer */
  if(!$(itemsInOffer).data('st-loaded-prices') &&
        $(itemsInOffer + ' .item.app730.context2').length > 0 && $(itemsInOffer + '.item.unknownItem').length == 0){

    $(itemsInOffer + ' .item.app730.context2').each(addItemDetails);
    $(itemsInOffer).data('st-loaded-prices', true);
  }

  if($('#inventory_' + steamID + '_730_2').css('display') == 'block'){
    /* inventory has loaded, let's put in the prices */
    $('#inventory_' + steamID + '_730_2 .item.app730.context2').each(addItemDetails)

    editActionMenu(true, steamID);

    /* make everything fade in */
    $('.st-trade-offer-prices, .st-item-price, .st-item-no-price, .st-item-float').hide().fadeIn();
  } else {
    /* if the display isn't block, they haven't loaded yet */
    setTimeout(function(){ loadPricesFor(steamID, isMyItems); }, 750)
  }

  function addItemDetails(){
    /* remove the cs-go icon that takes up space */
    //$(this).parent().parent().find('.slot_applogo').remove()
    /* ^ for some reason, you can't remove items from a trade offer because
       it relies on the app logo */

    var id = $(this).attr('id').split('item730_2_')[1];

    /* only indicate the item is in a trade for items that aren't in the trade offer */
    var itemAlreadyInTrade = inventories.itemsInTrade[isMyItems ? 'me' : steamID].indexOf(id) > -1
    if(!$(this).parent().hasClass('slot_inner') && itemAlreadyInTrade) $(this).css('background-color', 'hsla(' + settings.intradebg + ', 35%, 21%, 0.74902)')

    var item = inventories.infoPairs[steamID][id];

    /* sometimes, for some reason, we won't be able to match the item asset id
       to an item in the inventory we've loaded. this may be because the inventory
       didn't load as expected, but I'm not sure yet. so in the case this happens
       and we can't match the id to an item in the inventory, just log and skip the
       item (we have no class id to match as a back up either...) */
    if(!item){
      return console.log('item glitched', steamID, item);
    }

    $(this).data('st-price', Number(item.price) || 0);
    $(this).data('st-type', item.type);

    if(item.price){
      $(this).append('<span style="font-size: ' + settings.fontsizebottom + 'px" class="st-item-price">' + formatPrice(item.price) + '</span>');
    } else {
      /* only in trade offers we want to get rid of
         the box shadow to make everything clearer */
      $(this).append('<div class="st-item-no-price" style="box-shadow: 0px 0px black"></div>');
      /* only if this is just a normal item do we want to add the red
         outline so we can identify stattrak/souvenir */
      if(['rgb(210, 210, 210)', 'rgb(134, 80, 172)'].indexOf($(this).css('border-color')) > -1) $(this).css('border-color', 'red')
    }

    $(this).append('<span style="font-size: ' + settings.fontsizebottom + 'px" class="st-item-wear">' + item.wear + '</span>');

    /* add stickers */
    for(var i = 0; i < item.stickers.length; i++){
      $(this).append(
        '<img class="st-item-sticker" src="' + item.stickers[i] + '" style="margin-left: ' + (i * 25) + '%">'
      )
    }
  }
}

/* calls the callback when the inventory for the given steamID loads */
function whenInventoryLoads(steamID, callback){
  injectScriptWithEvent({ '%%steamID%%': steamID, '%%steamID%%': steamID }, function(){
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('%%event%%', true, true, true);

    var _interval = setInterval(function(){
      if(g_ActiveInventory.owner.strSteamId == '%%steamID%%' && !g_ActiveInventory.BIsPendingInventory()){
        window.dispatchEvent(evt);
        clearInterval(_interval);
      }
    }, 150)
  }, callback)
}
