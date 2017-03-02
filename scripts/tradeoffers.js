$('.profile_leftcol').prepend(
    '<h4 class="st-loading-details"><span id="st-load-my-inv">Loading inventory...</span><span id="st-load-my-floats"> | Loading Floats: attempt #0</span></h4><hr class="st-trade-offer-divider">'
).hide().fadeIn();

$('.maincontent').css('background-color', 'rgba(38, 38, 39, 0.65)')

/* sentScreen is true when on sent offers page */
var sentScreen = window.location.pathname.split('/').indexOf('sent') > -1
/* we have to set the primary/secondary items like this because on the
 incoming offers page, our partner has the primary items, but on the sent
 offers page it's the opposite */
var myOfferClass = sentScreen ? 'primary' : 'secondary';
var theirOfferClass = sentScreen ? 'secondary' : 'primary';

var myInventory = {
    infoPairs: {},
    details: {}
};

var theirInventory = {
    infoPairs: {},
    details: {}
};

getSteamID(true, function(steamID){
    getInventory(steamID, function(error, infoPairs, idPairs){
        if(error){
            $('#st-load-my-floats').hide();
            return $('#st-load-my-inv').text('Error loading inventory').hide().fadeIn();
        }

        $('#st-load-my-inv').text('Loaded inventory!').hide().fadeIn();
        myInventory.infoPairs = infoPairs;
        setupOffers();
    });
}, false)

getSteamID(true, function(steamID){
    getInventoryDetails(steamID, function(details, attempt){
        if(!details){
            return $('#st-load-my-floats').text(' | Loading Floats: attempt #' + attempt);
        }

        $('#st-load-my-floats').text(' | Loaded Floats Successfully');

        myInventory.details = details;

        showFloats();
        /* we want to populate our items with details but only when we get infoPairs information */
        function showFloats(){
            if(Object.keys(myInventory.infoPairs).length == 0) return setTimeout(showFloats, 500);

            $('.tradeoffer_items_ctn').each(function(index){
                if(!$(this).data('st-loaded-prices')) return;

                $(this).find('.tradeoffer_items.' + myOfferClass + ' .tradeoffer_item_list .trade_item').each(function(){
                    populateDetails(true, this);
                });

                /* this class is added inside populateDetails, so we make the appended
                 overlays fade in now */
                $('.st-item-float').hide().fadeIn();
            })
        }
    }, 0)
}, true)

function populateDetails(loadingMyItems, e){
    var inventory = loadingMyItems ? myInventory : theirInventory;

    var id = $(e).data('economy-item').split('/')[2];

    /* if we don't have any information no this item, skip the overlay */
    if(!inventory.details[id]) return;

    var text = inventory.details[id].float;

    /* add pattern information (e.g. fade percentage) */
    if(inventory.details[id].phase){
        text += ' ' + inventory.details[id].phase;
    }

    if(inventory.details[id].seed && inventory.infoPairs[id]){
        text += formatPattern(inventory.infoPairs[id].name, inventory.details[id].seed);
    }

    /* pull the fraud warning icon down a bit to make space for our overlay */
    $(e).find('.slot_app_fraudwarning').css('margin-top', '15px');

    $(e).append('<span style="font-size: ' + settings.fontsizetop + 'px" class="st-item-float">' + text + '</span>');
}

function setupOffers(){
    $('.tradeoffer_items_ctn').each(function(index){
        $(this).parent().find('.tradeoffer_footer_actions').prepend(
            '<div class="st-trade-offer-button"><a id="st-check-offer-' + index + '" class="whiteLink">Show Prices</a> | </div>'
        );

        $(this).data('st-loaded-prices', false);

        $('#st-check-offer-' + index).click(function(){
            /* if we've already loaded info for this offer, skip */
            if($('.tradeoffer_items_ctn').eq(index).data('st-loaded-prices')) return;

            loadPricesForOffer(index);
            $('.tradeoffer_items_ctn').eq(index).data('st-loaded-prices', true);
        })
    })

    $('.st-trade-offer-button').hide().fadeIn();
}

function loadPricesForOffer(index){
    var offer = $('.tradeoffer_items_ctn:eq(' + index + ')');

    /* if we're on the sent screen, change the colour of the background
     of the offers to make everything easier to see and read */
    if(sentScreen){
        offer.css({
            '-webkit-transition': 'background 1s',
            '-moz-transition': 'background 1s',
            '-o-transition': 'background 1s',
            'transition': 'background 1s',
            'background-color': 'rgba(255, 255, 255, 0.1)'
        })
    }

    /* set the base 'attempt 0' for loading the floats */
    $('#st-check-offer-' + index).html('Loading Floats: attempt #<span id="st-load-floats-' + index + '">0</span>').hide().fadeIn();

    /* get the steamid and call the function that loads the floats */
    var steamID = toSteam64(offer.find('.tradeoffer_items.' + theirOfferClass + ' .tradeoffer_avatar').data('miniprofile'))

    /* check if this profile has verification */
    checkVerification(steamID, function(response){
        if(response.success && response.verified){
            if(sentScreen){
                $(offer).parent().find('.tradeoffer_header').append(
                    '<div class="btn_grey_grey btn_medium st-verified-trade-outer"><span class="st-verified-trade-inner">' + response.name + '</span></div>'
                )
            } else {
                $(offer).parent().find('.tradeoffer_partner').before(
                    '<div style="margin-right: 10px" class="btn_grey_grey btn_medium st-verified-trade-outer"><span class="st-verified-trade-inner">' + response.name + '</span></div>'
                )
            }
        }
    })

    getInventoryDetails(steamID, function(details, attempt){
        /* if we haven't got the details, update the attempt count */
        if(!details){
            return $('#st-load-floats-' + index).text(attempt).hide().fadeIn(250);
        }

        $('#st-check-offer-' + index).text('Loaded Floats Successfully').hide().fadeIn();

        theirInventory.details = details;

        /* add all the floats to the items */
        $('.tradeoffer_items_ctn:eq(' + index + ') .tradeoffer_items.' + theirOfferClass + ' .tradeoffer_item_list .trade_item').each(function(){
            populateDetails(false, this);
        })
    }, 0);

    var url = offer.parent().find('.tradeoffer_partner a').attr('href');
    getInventory(steamID, function(error, infoPairs, idPairs){
        /* if we couldn't get the inventory, display an error message */
        if(error){
            return offer.find('.tradeoffer_items.' + theirOfferClass + ' .tradeoffer_item_list').after(
                '<div class="st-trade-offer-prices"><div class="st-trade-offer-items-warning">Warning! Unable to load either our inventory or our partner\'s inventory.</div></div>'
            )
        }

        theirInventory.infoPairs = infoPairs;

        var summary = {
            mine:     { items: 0, total: 0, types: {} },
            partner:  { items: 0, total: 0, types: {} }
        }, possiblyGlitched = false;

        $('.tradeoffer_items_ctn:eq(' + index + ') .tradeoffer_items .tradeoffer_item_list .trade_item').each(function(){
            /* add an aesthetically pleasing box shadow */
            $(this).css('box-shadow', 'inset 0px 0px 10px -1px black');

            /* the data-economy-item attr stores information about the item */
            var economyItem = $(this).data('economy-item').split('/');
            /* it's the assetid if the first id is '730', else class id if the
             first id is 'classid' */
            var id = economyItem[2];

            var item = economyItem[0] == '730' ? infoPairs[id] : idPairs[id + '_' + economyItem[3]];

            if(!item && economyItem[0] === 'classinfo'){
                possiblyGlitched = true;
                /* if we still don't have the item, let's check against id pairs,
                 this assumes that the id is a class id so we just check for
                 a matching class id */
                for(var pair in idPairs){
                    if(pair.split('_')[0] == id) item = idPairs[pair]
                }
            }

            /* if item is not defined, it probably means we're trying
             to load data for our own items which is stored in myInventory */
            if(!item){
                /* if we still don't have the item and the first id is 'classinfo' it
                 means the item is incredibly glitched out, we have no information for it */
                if(economyItem[0] === 'classinfo') return

                item = myInventory.infoPairs[id];

                /* if we still have no item, we can't do anything */
                if(!item) return

                /* build up a summary */
                summary.mine.items += 1;
                summary.mine.total += item.price ? item.price : 0;

                if(!summary.mine.types[item.type]){
                    summary.mine.types[item.type] = 1;
                } else {
                    summary.mine.types[item.type] += 1;
                }

            } else {
                summary.partner.items += 1;
                summary.partner.total += item.price ? item.price : 0;

                if(!summary.partner.types[item.type]){
                    summary.partner.types[item.type] = 1;
                } else {
                    summary.partner.types[item.type] += 1;
                }
            }

            if($(this).parent().parent().hasClass('secondary')){
                /* change the height/width of the secondary items in the offer to match the
                 size of the primary items, also makes the text easier to read */
                $(this).css('height', '96px');
                $(this).css('width', '96px');
                $(this).find('img').remove();
                /* and now replace the image with a more suitably sized image */
                $(this).prepend('<img src="https://steamcommunity-a.akamaihd.net/economy/image/' + item.img + '/96fx96f"/>').hide().fadeIn();
            }

            $(this).data('st-price', item.price || 0);

            /* if we have a price, append the price else append a red element to the item */
            if(item.price){
                $(this).append('<span style="font-size: ' + settings.fontsizebottom + 'px" class="st-item-price">' + formatPrice(item.price) + '</span>');
            } else {
                $(this).append('<div class="st-item-no-price"></div>');
            }

            $(this).append('<span style="font-size: ' + settings.fontsizebottom + 'px" class="st-item-wear">' + item.wear + '</span>');

            /* add stickers */
            for(var i = 0; i < item.stickers.length; i++){
                $(this).append(
                    '<img class="st-item-sticker" src="' + item.stickers[i] + '" style="margin-left: ' + (i * 25) + '%">'
                )
            }
        })

        /* sort their items by price*/
        offer.find('.tradeoffer_items.' + theirOfferClass + ' .tradeoffer_item_list .trade_item').sort(function(a, b) {
            return $(b).data('st-price') - $(a).data('st-price');
        }).prependTo(offer.find('.tradeoffer_items.' + theirOfferClass + ' .tradeoffer_item_list'));

        /* sort my items by price */
        offer.find('.tradeoffer_items.' + myOfferClass + ' .tradeoffer_item_list .trade_item').sort(function(a, b) {
            return $(b).data('st-price') - $(a).data('st-price');
        }).prependTo(offer.find('.tradeoffer_items.' + myOfferClass + ' .tradeoffer_item_list'));

        /* add the summary of their items to the bottom of the offer */
        offer.find('.tradeoffer_items.' + theirOfferClass + ' .tradeoffer_item_list').after(
            '<div class="st-trade-offer-prices">' + formatPrice(summary.partner.total) +
            '<div class="st-display-right">' + summary.partner.items + ' ' +
            (summary.partner.items == 1 ? 'item' : 'items') + '</div>' + buildItemSummary(summary.partner.types) + '</div>'
        );


        /* add a summary of our items to the bottom of the offer */
        offer.find('.tradeoffer_items.' + myOfferClass + ' .tradeoffer_item_list').after(
            '<div class="st-trade-offer-prices">' + formatPrice(summary.mine.total) +
            '<div class="st-display-right">' + summary.mine.items + ' ' +
            (summary.mine.items == 1 ? 'item' : 'items') + '</div>' + buildItemSummary(summary.mine.types) + '</div>'
        );

        /* if it may be glitched, double check, else add messages if necessary */
        if(possiblyGlitched || (summary.partner.items == 0 && summary.mine.items == 0)){
            isOfferGlitched(offer.parent().attr('id').split('_')[1], function(glitched){
                if(!glitched) return;
                offer.find('.tradeoffer_items.' + myOfferClass + ' .st-trade-offer-prices').append(
                    '<hr class="st-trade-offer-divider"><div class="st-trade-offer-items-glitched">Note: this appears to be a glitched offer</div>'
                );
            })
        } else {
            /* if they have no items in the offer, set up a warning */
            if(summary.partner.items == 0){
                offer.find('.tradeoffer_items.' + theirOfferClass + ' .st-trade-offer-prices').append(
                    '<hr class="st-trade-offer-divider"><div class="st-trade-offer-items-warning">Warning! You will not receive any items in this trade.</div>'
                );
            }

            /* if we have no items in the offer, that's awesome! */
            if(summary.mine.items == 0){
                offer.find('.tradeoffer_items.' + myOfferClass + ' .st-trade-offer-prices').append(
                    '<hr class="st-trade-offer-divider"><div class="st-trade-offer-items-awesome">Awesome! You\'re getting free items!</div>'
                );
            }
        }

        if(Object.keys(myInventory.details).length > 0){
            /* add all the floats to the items */
            offer.find('.tradeoffer_items.' + myOfferClass + ' .tradeoffer_item_list .trade_item').each(function(){
                populateDetails(true, this);
            });
        }

        /* make everything fade in */
        offer.find('.st-trade-offer-prices, .st-item-price, .st-item-no-price, .st-item-float').hide().fadeIn();
    });
}

/* injection required to load sticker prices */
injectScriptWithEvent({}, stickerPriceInjection, stickerPriceCallback)