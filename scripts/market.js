populateWithLinks();

function populateWithLinks(){
  $('.market_recent_listing_row').each(function(){
    var id = $(this).attr('id').split('_')[1], e = this;

    getItem(id, function(item){
      if($(e).data('st-loaded-info')) return;
      $(e).data('st-loaded-info', true);

      var stickers = [];
      item.descriptions.forEach(function(desc){
        if(desc.type != 'html' || desc.value.indexOf('Sticker Details') == -1) return;
        $(desc.value).find('img').each(function(){
          stickers.push($(this).attr('src'));
        })
      })

      var inspect = item.market_actions[0].link.replace('%assetid%', item.id);
      $('.listing_' + id).find('.market_listing_game_name').eq(0).after(
        ' - <span class="market_listing_game_name">view on</span> <a class="market_listing_game_name" target="_blank" href="https://i7xx.xyz/#/' + inspect.split('%20')[1] + '">floatr</a>' +
        ' / <a class="market_listing_game_name" id="st-metjm" target="_blank" href="https://metjm.net/extensionLink.php?inspectlink=' + inspect + '">metjm.net</a>'
      );

      for(var i = 0; i < stickers.length; i++){
        $('.listing_' + id).find('#st-metjm').after(
          '<img width="48" height="36" style="position: absolute; margin-top: -20px; margin-left: ' + (i * 48 /* width of sticker */) + 'px" src="' + stickers[i] + '">'
        );
      }
    });
  })
}

/* return asset information for the item */
function getItem(listingID, callback){
  injectScriptWithEvent({ '%%listingID%%': listingID }, function(){
    window.dispatchEvent(new CustomEvent('%%event%%', {
      detail: g_rgAssets[730][2][g_rgListingInfo['%%listingID%%'].asset.id]
    }))
  }, callback)
}

/* the injection below will fire 'populateWithLinks' when the user
   changes the page of the items they're on */

injectScriptWithEvent(null, function(){
  g_oSearchResults.OnAJAXComplete = function () {
    g_oSearchResults.m_bLoading = false;
    window.dispatchEvent(new CustomEvent('%%event%%', {
      detail: ''
    }));
  };

  /* set max page size to 50 and reload */
  g_oSearchResults.m_cPageSize = 50;
  g_oSearchResults.GoToPage(1);
  setTimeout(function(){g_oSearchResults.GoToPage(0)}, 1000)
}, populateWithLinks)
