$('.maincontent').prepend(
  '<div class="gray_bevel for_text_input" style="width:500px"><input id="st-search-name" style="width:500px" placeholder="Which item are you looking for?"></div>' +
  '<a id="st-search-start" class="btn_darkblue_white_innerfade btn_medium btn_disabled" style="margin-left:10px"><span>Search</span></a>' +
  '<a id="st-search-load" class="btn_green_white_innerfade btn_medium" style="margin-left:10px"><span id="st-loaded">Load Inventories</span></a>' +
  '<div id="st-display"></div>'
)

var inventories = {}, profiles = {}, steamids = [], totalFriends = $('.friendBlock').length;

$('#st-search-load').click(function(){
  if($(this).data('st-loading')) return;
  $(this).data('st-loading', true)

  $('#st-search-start').removeClass('btn_disabled');
  $('#st-search-load').addClass('btn_disabled');
  $('#st-loaded').text('Loading: 0 / ' + totalFriends);

  $('.friendBlock').each(function(){
    /* it's not always a string, so for unity we ensure it's a string */
    var steamid = toSteam64($(this).data('miniprofile'))
    steamids.push(steamid)
    profiles[steamid] = $(this).find('.playerAvatar').css('display', 'inline-block')[0].outerHTML;
  })

  if(steamids.length > 0) inventoryFromIndex(0)

  function inventoryFromIndex(index){
    getInventory(steamids[index], function(infoPairs, idPairs){
      inventories[steamids[index]] = infoPairs;
      if((index + 1) < steamids.length) inventoryFromIndex((index + 1))
      $('#st-loaded').text('Loading: ' + Object.keys(inventories).length + ' / ' + totalFriends);
    })
  }
})

$('#st-search-start').click(function(){
  /* /[|() -]/g */
  var searchItem = $('#st-search-name').val().replace(/[|() -$-\/:-?{-~!"^_`\[\]\\'.£%^@&*+,|0-9]/g, '').toLowerCase()
  var withItems = {}

  for(var inv in inventories){
    for(var item in inventories[inv]){
      var item = inventories[inv][item]
      /* if this item we're currently on isn't a match, skip */
      if(item.name.replace(/[|() -$-\/:-?{-~!"^_`\[\]\\'.£%^@&*+,|0-9]/g, '').toLowerCase().indexOf(searchItem) == -1) continue;

      if(!withItems.hasOwnProperty(inv)) withItems[inv] = [item]
      else withItems[inv].push(item)
    }
  }

  $('#st-display').html('');
  for(var profile in withItems){
    /* count up the number of keys so we don't display them individually */
    var keyCount = {}
    withItems[profile].forEach(function(item){
      if(item.type != 'Key') return
      keyCount[item.name] = (keyCount[item.name] || 0) + 1
    })

    withItems[profile].sort(function(a, b){
      /* sort items by high price to low */
      if(isNaN(a.price)) a.price = 0
      if(isNaN(b.price)) b.price = 0
      return b.price - a.price
    })

    var items = []
    withItems[profile].forEach(function(item){
      if(item.type == 'Key') return

      items += '<a class="hoverunderline" href="http://steamcommunity.com/profiles/' + profile + '/inventory/#730_2_' + item.id + '" style="margin-right: 5px; color:#' + item.color + '">' + item.name + ' (' + item.wear + ')' + (item.price ? ' - ' + formatPrice(item.price) : '') + '</a><br>'
      //items += '<div style="float:left;margin-right:5px;width:60px;height:60px;background-color:rgba(51,51,51,0.70);border: 1px solid #' + item.color + '"><img src="https://steamcommunity-a.akamaihd.net/economy/image/' + item.img + '/60fx60f"></div>'
    })

    /* now display keys separately */
    for(var key in keyCount){
      items += '<a class="hoverunderline" href="http://steamcommunity.com/profiles/' + profile + '/inventory/" style="margin-right: 5px; color:#D2D2D2">' + key + ' x ' + keyCount[key] +'<br></a>'
    }

    /* and append everything */
    $('#st-display').append(
      '<div class="st-search-profile"><a href="http://steamcommunity.com/profiles/' + profile + '">' + profiles[profile] + '</a><div class="st-search-item-list">' + items + '</div></div>'
    )
  }
})
