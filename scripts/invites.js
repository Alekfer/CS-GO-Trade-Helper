$('.invite_row').sort(function(a, b){
    var personOne = $(a).find('.friendPlayerLevelNum').text();
    var personTwo = $(b).find('.friendPlayerLevelNum').text();
    return personTwo - personOne;
}).appendTo('#BG_bottom');

var queue = [];
$('.invite_row').each(function(){
    $(this).data('st-level', Number($(this).find('.friendPlayerLevelNum').text()))
    $(this).data('st-value', -1)
    var steamID = $(this).find('.acceptDeclineBlock').children()[0].href.split('\'')[1];
    queue.push({steamID: steamID, element: this})
})

/* if true, it will only process inventories,
 else it will only process verification checks */
processQueue(true, 0)
processQueue(false, 0)
function processQueue(inventoryOnly, index){
    if(index > queue.length - 1) return
    var info = queue[index];

    $(info.element).find('.inviterBlock').prepend(
        '<a id="st-profile-value-' + info.steamID + '" href="https://steamcommunity.com/profiles/' + info.steamID + '/inventory" class="whiteLink st-banned"></a>' +
        '<a id="st-profile-rep-' + info.steamID + '" href="https://steamrep.com/profiles/' + info.steamID + '" class="whiteLink st-banned"></a>'
    );

    if(inventoryOnly){
        getInventory(info.steamID, function(error, infoPairs, idPairs){
            setTimeout(function(){
                processQueue(inventoryOnly, index + 1)
            }, 2000);

            var invValue = 0;
            for(var item in infoPairs){
                if(infoPairs[item] && infoPairs[item].price) invValue += infoPairs[item].price
            }

            /* if there was an error loading the inventory, set the inv value to -1
             so these profiles sink to the bottom when sorting */
            if(error) invValue = -1
            $(info.element).data('st-value', invValue);

            $('#st-profile-value-' + info.steamID).text(error ? '' : formatPrice(invValue))
        })
    } else {
        checkVerification(info.steamID, function(response){
            if(!response.success) return

            /* if the profile is a scammer, change the background row color */
            if (response.scammer && !response.verified) {
                $(info.element).css('background-color', '#6f1b1b');
                $(info.element).find('.playerAvatar, .playerAvatar img').css('background', 'red')

                if (settings.autoignore) {
                    injectScript({'%%steamID%%': info.steamID}, function () {
                        javascript:FriendAccept('%%steamID%%', 'ignore');
                    })
                }
            }

            if(response.verified && response.name){
                $(info.element).addClass('st-verified')
                $(info.element).find('.acceptDeclineBlock').before(
                    '<div class="st-verified-profile st-verified-invites ' + (response.scammer ? 'st-verified-scammer' : '') + '">' + response.name + '</div>'
                )
            }

            $(info.element).data('st-verified', true)
        })

        getPlayerInfo(info.steamID, function(err, summary){
            processQueue(inventoryOnly, index + 1);
            /* error with api call, ignore this profile */
            if(err || !summary) return;

            if(summary != 'none') $(info.element).addClass('st-scammer')
            $('#st-profile-rep-' + info.steamID).text(summary == 'none' ? 'clean steamrep' : summary);
        })
    }
}

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
    '</div></div>' +
    '<a id="st-sort-level" style="margin: 5px 5px 0px 0px" class="btn_small btnv6_blue_hoverfade"><span>Sort by Level</span></a>' +
    '<a id="st-sort-value" style="margin: 5px 5px 0px 0px" class="btn_small btnv6_blue_hoverfade"><span>Sort by Inventory Value</span></a>'
)
$('.sectionText').remove()

var sortAsc = true;
['level', 'value'].forEach(function(filter){
    $('#st-sort-' + filter).click(function(){
        $('.invite_row').sort(function(a, b){
            var personOne = $(a).data('st-' + filter);
            var personTwo = $(b).data('st-' + filter);

            if(filter === 'value'){
                /* if the attribute is -1 it means we have no inventory value yet, so adjust the metadata
                 for the inv value to ensure that these profiles with no information yet always sink to the bottom */
                if(personOne === -1) personOne = sortAsc ? -1 : 9999999;
                if(personTwo === -1) personTwo = sortAsc ? -1 : 9999999;
            }

            /* (TODO) commented due to bugs, will sort out some time in the future */
            //if($(a).data('st-verified')) personOne = sortAsc ? 9999999 : -1;
            //if($(b).data('st-verified')) personTwo = sortAsc ? 9999999 : -1;

            return sortAsc ? personTwo - personOne : personOne - personTwo;
        }).appendTo('#BG_bottom');
        sortAsc = !sortAsc;
    })
})

function getPlayerInfo(steamID, callback){
    /* implement fall back methods
     https://steamrep.com/util.php?op=getSteamBanInfo&id=steamID&tm=timeStamp
     ^ first method was nuked

     http://steamrep.com/api/beta4/reputation/76561198073590377
     http://steamrep.com/id2rep.php?steamID32=STEAM_0:1:56662324 */
    $.ajax({
        url: 'https://steamrep.com/api/beta4/reputation/' + steamID,
        success: function(response) {
            callback(null, $(response).find('reputation summary').text())
        }, error: function(){
            callback(true);
        }
    })
}
