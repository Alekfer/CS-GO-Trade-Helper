populateWithLinks();

function populateWithLinks(){
  $('.market_recent_listing_row').each(function(){
    if($(this).data('st-loaded-info')) return;
    $(this).data('st-loaded-info', true);
    var id = $(this).attr('id').split('_')[1];

    getItem(id, function(item){
      var stickers = [];
      item.descriptions.forEach(function(desc){
        if(desc.type != 'html' || desc.value.indexOf('Sticker Details') == -1) return;
        $(desc.value).find('img').each(function(){
          stickers.push($(this).attr('src'));
        })
      })

      var inspect = item.market_actions[0].link.replace('%assetid%', item.id);
      $('.listing_' + id).find('.market_listing_game_name').eq(0).after(
        ' - <span class="market_listing_game_name">view on</span> <a class="market_listing_game_name" target="_blank" href="https://beta.glws.org/#' + inspect.split('%20')[1] + '">glws.org</a>' +
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
  /* random id to stop event confusion */
  var id = String(Math.random () * 1000).substr(0, 3);

  /* set up event listener for steam id */
  window.addEventListener('assetInfo' + id, function (e) {
    callback(e.detail);
  });

  /* create script that will emit the steam id */
  var script = document.createElement('script');
  script.textContent = '(' + function () {
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('assetInfo%%id%%', true, true, g_rgAssets[730][2][g_rgListingInfo['%%listingID%%'].asset.id]);
    window.dispatchEvent(evt); } + ')();';

  script.textContent = script.textContent.replace('%%listingID%%', listingID);
  script.textContent = script.textContent.replace('%%id%%', id);

  document.body.appendChild(script);
  script.parentNode.removeChild(script);
}

/* the injection below will fire 'populateWithLinks' when the user
   changes the page of the items they're on */

/* random id to stop event confusion */
var id = String(Math.random () * 1000).substr(0, 3);

/* set up event listener for steam id */
window.addEventListener('newResults' + id, populateWithLinks);

/* create script that will emit the steam id */
var script = document.createElement('script');
script.textContent = '(' + function () {
  var evt = document.createEvent('CustomEvent');
  evt.initCustomEvent('newResults%%id%%', true, true, '');
  g_oSearchResults.OnAJAXComplete = function () {
    g_oSearchResults.m_bLoading = false;
    window.dispatchEvent(evt);
  };
} + ')();';

script.textContent = script.textContent.replace('%%id%%', id);

document.body.appendChild(script);
script.parentNode.removeChild(script);
