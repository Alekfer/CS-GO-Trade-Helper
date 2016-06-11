modernise()
$('#BG_bottom').css({'background-image': 'inherit', 'background-color': 'rgba(26,41,58,0.75)'})

$('.invite_row').sort(function(a, b){
  var personOne = $(a).find('.friendPlayerLevelNum').text();
  var personTwo = $(b).find('.friendPlayerLevelNum').text();
  return personTwo - personOne;
}).appendTo('#BG_bottom');

$('.invite_row').each(function(){
  var steamID = $(this).find('.acceptDeclineBlock').children()[0].href.split('\'')[1];
  var e = this;
  getPlayerInfo(steamID, function(data){
    /* error with api call, ignore this profile */
    if(data.err || typeof(data.data) == 'string' && data.data.indexOf('Error') > -1 && !data.data.error) return;
    data = data.data;

    var bans = [];
    if(data.hasOwnProperty('tradebanstate') && data.tradebanstate !== 'None') bans.push('TRADE BANNED');
    if(data.hasOwnProperty('scammer') && data.scammer) bans.push('SCAMMER');
    if(data.hasOwnProperty('caution') && data.caution) bans.push('CAUTION');

    if(bans.length > 0){
      $(e).addClass('st-scammer')
      $(e).find('.acceptDeclineBlock').before(
        '<a href="https://steamrep.com/profiles/' + steamID + '" class="whiteLink st-banned">' + bans.join(' | ') + '</a>'
      );
    } else {
      $(e).find('.acceptDeclineBlock').before(
        '<a href="https://steamrep.com/profiles/' + steamID + '" class="whiteLink st-banned">clean</a>'
      );
    }
  })
})

/* if we have one friend invite, the singlular ('you have 1 friend invite') element
   is displayed, if not we just get the plural count */
var fInvites = $('#pinvites_singular').css("display") == 'none' ? $('#pinvites_count').text() : 1;
var gInvites = $('#ginvites_singular').css("display") == 'none' ? $('#ginvites_count').text() : 1;

/* if we have no invites, or there is no group invite element, set the text to 'no' */
if($('.sectionText:not(.groups)').text().indexOf('You have no pending invites.') > -1) fInvites = 'no';
if($('.sectionText.groups').length == 0) gInvites = 'no';

/* the buttons for the friend and group invites */
var fInviteButtons = '<a style="margin-top: 5px" class="btn_small btnv6_blue_hoverfade" href="' + window.location.pathname.split('home/invites/')[0] + 'home_process?action=ignoreAll&amp;type=friends&amp;sessionID=' + getCookie('sessionid') + '"><span>Ignore All</span></a>'
var gInviteButtons = '<a style="margin-top: 5px" class="btn_small btnv6_blue_hoverfade" href="' + window.location.pathname.split('home/invites/')[0] + 'home_process?action=ignoreAll&amp;type=groups&amp;sessionID=' + getCookie('sessionid') + '"><span>Ignore All</span></a>'

$('#errorText').after(
  '<div class="st-containerTwo"><div class="st-containerOne">' +
    '<div class="st-columnOne">' +
	   '<center><span class="st-invite-block">You have ' + fInvites + ' friend invite' + (fInvites != 'no' && fInvites == 1 ? '' : 's') + '</span><br>' + (fInvites === 'no' ? '' : fInviteButtons) + '</center>' +
    '</div>' +
    '<div class="st-columnTwo">' +
      '<center><span class="st-invite-block">You have ' + gInvites + ' group invite' + (gInvites != 'no' && gInvites == 1 ? '' : 's') + '</span><br>' + (gInvites === 'no' ? '' : gInviteButtons) + '</center>' +
    '</div>' +
  '</div></div>'
)
$('.sectionText').remove()

function getPlayerInfo(steamID, callback){
  /* implement fall back methods
     http://steamrep.com/api/beta4/reputation/76561198073590377
     http://steamrep.com/id2rep.php?steamID32=STEAM_0:1:56662324 */
  $.ajax({
    url: 'https://steamrep.com/util.php',
    data: {
      op: 'getSteamBanInfo',
      id: steamID,
      tm: Math.round(new Date().getTime() / 1000) - 9
    },
    success: function(response) {
      callback({err: false, data: response});
    }, error: function(){
      callback({err: true});
    }
  })
}
