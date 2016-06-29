getProfileData(function(data){
  /* ensure we're on a profile page */
  if(!data || !data.url || !data.steamid) return;

  /* replaces background (if they don't have one) and the texture with a nice gradient */
  $('.profile_header_bg_texture, .no_header.profile_page:not(.has_profile_background)').css('background', 'url("http://store.akamai.steamstatic.com/public/images/v6/colored_body_top.png?v=2") center top no-repeat #1b2838')

  /* set a box shadow around their profile picture */
  $('.playerAvatar.profile_header_size').css('box-shadow', '0px 0px 15px -3px black')

  checkVerification(data.steamid, function(response){
    if(response.success && response.verified){
      $('.profile_header_content').before('<div class="st-verified-profile">' + response.name + '</div>')
    }
  })

  /* add a SteamRep check here in the future */
})

function getProfileData(callback){
  injectScriptWithEvent(null, function(){
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('%%event%%', true, true, g_rgProfileData ? g_rgProfileData : null);
      window.dispatchEvent(evt);
  }, callback)
}

function loadMoreComments(){
  injectScript({ '%%pageSize%%': 20 }, function(){
    g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].m_cPageSize = '%%pageSize%%';
    /* iCurrentPage is 0 when the page loads, to reload the comments we need to set it
       to -1 (GoToPage will return if iCurrentPage == pageToGoTo) and then go to page 0 */
    g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].m_iCurrentPage = -1;
    g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].GoToPage(0)
  })
}
