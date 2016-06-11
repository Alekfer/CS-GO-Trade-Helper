modernise()

var inventory = {
  infoPairs: {},
  sortAsc: false,
  total: 0
};

$('#active_inventory_page').before(
  '<h4 class="st-log-box"><span id="st-load-prices" class="st-log-msg">Loading prices...</span>' +
  '<span id="st-load-floats" class="st-log-msg">Loading Floats: attempt #0</span></h4>'
);

getSteamID(true, function(steamID){
  getInventory(window.location.pathname, steamID, setupItems, getInventory);

  getInventoryDetails(steamID, function(details, attempt){
    if(!details){
      return $('#st-load-floats').text('Loading Floats: attempt #' + attempt);
    }

    $('#st-load-floats').text('Loaded Floats Successfully').hide().fadeIn();

    populateDetails();
    /* we want to populate our items with details but only when we get infoPairs information */
    function populateDetails(){
      if(Object.keys(inventory.infoPairs).length == 0) return setTimeout(populateDetails, 500);

      $('.itemHolder:not(.disabled)').each(function(){
        if(!$(this).find('.item.app730.context2').attr('id')) return;
        var id = $(this).find('.item.app730.context2').attr('id').split('item730_2_')[1];

        /* if we have no details for this item, set the float to max (will not be displayed)*/
        if(!details[id]) return $(this).children().eq(0).data('st-float', -1);

        /* round the float to 5 decimal places */
        var text = details[id].float.toFixed(6);

        /* add the float to the metadata for this element */
        $(this).children().eq(0).data('st-float', Number(text));

        /* add pattern information (e.g. fade percentage) */
        if(details[id].phase.name){
          text += ' ' + details[id].phase.name;
        }

        if(details[id].seed){
          text += formatPattern(inventory.infoPairs[id].name, details[id].seed);
        }

        /* pull the fraud warning icon down a bit to make space for our overlay */
        $(this).find('.slot_app_fraudwarning').css('margin-top', '15px');

        $(this).append('<span class="st-item-float">' + text + '</span>');
      });

      $('.st-item-float').hide().fadeIn();

      $('#st-sort-inventory-price').after(
        '<a id="st-sort-inventory-float" class="btn_darkblue_white_innerfade btn_medium new_trade_offer_btn"' +
        'style="margin-left: 5px">' +
        '<span>Sort by float</span>' +
        '</a>'
      );

      $('#st-sort-inventory-float').click(function(){sortInventory(false)});
    }
  }, 0)
})

function sortInventory(byPrice){
  if(window.location.hash.substr(1).length > 0 &&
     window.location.hash.substr(1) !== '730') return;

  expandInventory();

  $('.itemHolder').sort(function(a, b) {
    var attrOne = $(a).children().eq(0).data(byPrice ? 'st-price' : 'st-float');
    var attrTwo = $(b).children().eq(0).data(byPrice ? 'st-price' : 'st-float');

    /* if the attribute is -1 it means we have no float/price value, so adjust the metadata
       float value or price to ensure that these items with no value always sink to the bottom */
    if(attrOne == -1) inventory.sortAsc ? attrOne = byPrice ? 9999999 : 1 : attrOne = 0;
    if(attrTwo == -1) inventory.sortAsc ? attrTwo = byPrice ? 9999999 : 1 : attrTwo = 0;

    return inventory.sortAsc ? attrOne - attrTwo : attrTwo - attrOne;
  }).appendTo('.inventory_page:nth-child(1)');

  inventory.sortAsc = !inventory.sortAsc;
}

function expandInventory(){
  if(window.location.hash.substr(1).length > 0 &&
     window.location.hash.substr(1) !== '730') return;

  /* disable the button */
  $('#st-expand-inventory').addClass('btn_disabled');

  /* remove this element, don't know what it is but it messes up the layout */
  $('#market_sell_dialog_item').parent().remove();

  /* display all the pages in the inventory */
  $('.inventory_page').each(function(){
    $(this).css('display', '');
  })

  /* the images only load when necessary to increase page loading speed,
     so we need to delete them all and manually load them and
     insert the correct images into each item */
  $('.item.app730.context2').each(function(){
    $(this).find('img').remove();
    var id = $(this).attr('id').split('item730_2_')[1];

    var img = inventory.infoPairs[id].img;
    /* we need to set a position of absolute here because steam will seemingly
       randomly add the item image again and we want them to just collapse on each
       other and not stack (looks glitchy) */
    $(this).append('<img style="position:absolute" src="https://steamcommunity-a.akamaihd.net//economy/image/' + img + '/96fx96f"/>');
  })

  /* remove inventory page controls, we set it to hidden because if
     we remove it, it disrupts the page structure */
  $('#inventory_pagecontrols').css('visibility', 'hidden');

  /* remove the empty item boxes */
  $('.itemHolder.disabled').each(function(){
    $(this).remove();
  })

  /* remove the border/background color around the default inventory page */
  $('.trade_item_box').css('background-color', '#1F1F1F').css('border', '0');
}

/* load the prices into the items in the inventory */
function setupItems(infoPairs){
  /* if we don't have the prices yet or if the loading inventory element cover is still in place, do not
     load the overlay on the items, check again after a delay */
  if(Object.keys(prices).length == 0 || $("#pending_inventory_page").css("display") == 'block'){
    return setTimeout(function(){
      setupItems(infoPairs);
    }, 500);
  }

  inventory.infoPairs = infoPairs;

  /* for each inventory item, add the price element */
  $('.item.app730.context2').each(function(){
    var id = $(this).attr('id').split('item730_2_')[1];

    var item = infoPairs[id];

    if(item.price){
      inventory.total += Number(item.price);
      $(this).append('<span class="st-item-price">$' + item.price.toFixed(2) + '</span>');
    }

    $(this).data('st-price', Number(item.price) || -1);

    $(this).append('<span class="st-item-wear">' + item.wear + '</span>');
    if(!item.tradable){
      $(this).append('<div class="st-item-not-tradable"></div>')
    }

    /* add stickers */
    for(var i = 0; i < item.stickers.length; i++){
      $(this).append(
        '<img class="st-item-sticker" src="' + item.stickers[i] + '" style="margin-left: ' + (i * 25) + '%">'
      )
    }
  })

  /* Add the buttons/labels */
  $('#st-load-prices').parent().before(
    '<a id="st-expand-inventory" class="btn_darkblue_white_innerfade btn_medium new_trade_offer_btn"' +
      'style="margin-left: 17px">' +
      '<span>Expand Inventory</span>' +
    '</a>' +
    '<a id="st-sort-inventory-price" class="btn_darkblue_white_innerfade btn_medium new_trade_offer_btn"' +
      'style="margin-left: 5px">' +
      '<span>Sort by price</span>' +
    '</a>'
  );

  $('#st-expand-inventory').click(expandInventory);
  $('#st-sort-inventory-price').click(function(){sortInventory(true)});

  $('#st-load-prices').fadeOut(function(){
    $(this).text('Inventory: ' + Object.keys(infoPairs).length + ' items worth $' + inventory.total.toFixed(2) + '!').fadeIn();
  })

  /* make everything fade in */
  $('.st-trade-offer-prices, .st-item-price, .st-item-float').hide().fadeIn();
}
