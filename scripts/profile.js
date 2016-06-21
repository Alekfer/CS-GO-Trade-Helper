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
  /* random id to stop event confusion */
  var id = String(Math.random () * 1000).substr(0, 3);

  /* set up event listener for steam id */
  window.addEventListener('profileData' + id, function (e) {
    callback(e.detail);
  });

  /* create script that will emit the steam id */
  var script = document.createElement('script');
  script.textContent = '(' + function () {
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('profileData%%id%%', true, true, g_rgProfileData ? g_rgProfileData : null);
    window.dispatchEvent(evt); } + ')();';

  script.textContent = script.textContent.replace('%%id%%', id);

  document.body.appendChild(script);
  script.parentNode.removeChild(script);
}
