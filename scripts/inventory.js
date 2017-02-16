var inventory = {
    infoPairs: {},
    details: {},
    sortAsc: false,
    total: 0,
    loaded: false
};

/* keep checking so we know whether to remove traces or not */
setInterval(isInventoryActive.bind(null, 730, function(active){
    /* if the inventory is active, load prices etc else remove all traces (inventory has changed) */
    if(active){
        if(!inventory.loaded) inventoryProcess();
    } else {
        $('.st-log-box, #st-sort-inventory-float, #st-sort-inventory-price, #st-expand-inventory').remove()
    }
}), 1000)

/* check if the user is verified */
getSteamID(false, function(steamID){
    checkVerification(steamID, function(response){
        if(response.success && response.verified){
            $('.profile_small_header_text').before('<div class="st-verified-profile st-verified-inv-page">' + response.name + '</div>')
            /* after adding the verification, move the name down a little to give it space */
            $('.profile_small_header_text').css('bottom', '25px')
        }
    })
})

function inventoryProcess(){
    /* to stop this function from repeatedly being called */
    inventory.loaded = true;

    $('#active_inventory_page').before(
        '<h4 class="st-log-box"><span id="st-load-prices" class="st-log-msg">Loading prices...</span>' +
        '<span id="st-load-floats" class="st-log-msg">Loading Floats: attempt #0</span></h4>'
    );

    getSteamID(false, function(steamID){
        /* call this once manually as the HideLoadingIndicator isn't called when the page intially loads */
        getInventoryDetails(steamID, getInventoryDetailsCallback, 0)
        getActiveInventory(getActiveInventoryCallback)

        /* due to the new loading mechanism for inventories (only load when the page needs to be loaded, i.e. user is
         scrolling through pages) I need to create a listener event for when the new items are loaded - to do this
         I hijack their 'HideLoadingIndicator' function (as it's only called when the items are loaded) and use it
         to then retrieve the newly loaded items */
        injectScriptWithEvent(null, function(){
            g_ActiveInventory.m_owner.HideLoadingIndicator = function(){
                this.cLoadsInFlight--;
                if(!this.cLoadsInFlight){
                    $J(document.body).removeClass('inventory_loading');
                }

                window.dispatchEvent(new CustomEvent('%%event%%', {}));
            }
        }, function(){
            getActiveInventory(getActiveInventoryCallback)
        })

        function getActiveInventoryCallback(data){
            parseInventory(data.steamID, replicateSteamResponse(data), function(infoPairs, idPairs){
                inventory.infoPairs = infoPairs;
                setupItems(infoPairs, idPairs, data.totalItems)

                /* needs to be called after setting inventory.infoPairs */
                if(Object.keys(inventory.details).length == 0) {
                    getInventoryDetails(steamID, getInventoryDetailsCallback, 0)
                } else {
                    populateDetails()
                }
            })
        }

        function getInventoryDetailsCallback(details, attempt){
            if(!details){
                return $('#st-load-floats').text('Loading Floats: attempt #' + attempt);
            }

            $('#st-load-floats').text('Loaded Floats Successfully').hide().fadeIn();
            inventory.details = details;
            populateDetails();
        }

        function populateDetails(){
            /* we want to populate our items with details but only when we get infoPairs information */
            if(Object.keys(inventory.infoPairs).length == 0 || $('#pending_inventory_page').css('display') != 'none') {
                return setTimeout(populateDetails, 500);
            }

            $('.itemHolder:not(.disabled)').each(function(){
                if($(this).data('st-float-loaded') || !$(this).find('.item.app730.context2:not(.pendingItem)').attr('id')) return;
                var id = $(this).find('.item.app730.context2:not(.pendingItem)').attr('id').split('730_2_')[1];

                /* if we have no details for this item, set the float to max (will not be displayed)*/
                if(!inventory.details[id]) return $(this).children().eq(0).data('st-float', -1);

                var text = inventory.details[id].float;

                /* add the float to the metadata for this element */
                $(this).children().eq(0).data('st-float', text);

                /* add pattern information (e.g. fade percentage) */
                if(inventory.details[id].phase){
                    text += ' ' + inventory.details[id].phase;
                }

                if(inventory.details[id].seed){
                    text += formatPattern(inventory.infoPairs[id].name, inventory.details[id].seed);
                }

                /* pull the fraud warning icon down a bit to make space for our overlay */
                $(this).find('.slot_app_fraudwarning').css('margin-top', '15px');

                $(this).append('<span style="font-size: ' + settings.fontsizetop + 'px" class="st-item-float">' + text + '</span>');
                $(this).data('st-float-loaded', true);
            });

            $('.st-item-float').hide().fadeIn();

            /* populateDetails is called every time new items load into the inventory, so we need to only add the sort
             button if it's not already there */
            if($('#st-sort-inventory-float')[0] == undefined){
                $('#st-sort-inventory-price').after(
                    '<a id="st-sort-inventory-float" class="btn_darkblue_white_innerfade btn_medium new_trade_offer_btn"' +
                    'style="margin-left: 5px">' +
                    '<span>Sort by float</span>' +
                    '</a>'
                );

                $('#st-sort-inventory-float').click(sortInventory.bind(null, false));
            }
        }
    })
}

function sortInventory(byPrice){
    if(window.location.hash.substr(1).length > 0 &&
        window.location.hash.substr(1) !== '730') return;

    expandInventory();

    $('.itemHolder').has('.item.app730.context2:not(.pendingItem)').sort(function(a, b) {
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

    /* display all the pages in the inventory */
    $('.inventory_page').each(function(){
        $(this).css('display', '');
    })

    /* the images only load when necessary to increase page loading speed,
     so we need to delete them all and manually load them and
     insert the correct images into each item */
    $('.item.app730.context2:not(.pendingItem)').each(function(){
        $(this).find('img:not(.st-item-sticker)').remove();
        var id = $(this).attr('id').split('730_2_')[1];

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
function setupItems(infoPairs, idPairs, totalItems){
    /* if we don't have the prices yet or if the loading inventory element cover is still in place, do not
     load the overlay on the items, check again after a delay */
    if(Object.keys(prices).length == 0 || $("#pending_inventory_page").css("display") == 'block'){
        return setTimeout(setupItems.bind(null, infoPairs, idPairs), 500);
    }

    /* for each inventory item, add the price element */
    $('.item.app730.context2:not(.pendingItem)').each(function(){
        var id = $(this).attr('id').split('730_2_')[1];

        var item = infoPairs[id];

        if($(this).data('st-loaded')) return;

        if(item.price){
            inventory.total += item.price;
            $(this).append('<span style="font-size: ' + settings.fontsizebottom + 'px" class="st-item-price">' + formatPrice(item.price) + '</span>');
        }

        $(this).data('st-price', item.price || -1);

        $(this).append('<span style="font-size: ' + settings.fontsizebottom + 'px" class="st-item-wear">' + item.wear + '</span>');
        if(!item.tradable){
            $(this).append('<div class="st-item-not-tradable"></div>')
        }

        /* add stickers, each sticker element _needs_ to be inside a DIV element, I'm not 100% sure but I believe
         when Steam initialises each element it uses a generic img tag identifier to set the source of the image
         so if we load our content in before Steam intialises the element it will set all images inside the item element
         to the image of the gun it's initialising... wrapping our image element in a div stops it from being identified */
        for(var i = 0; i < item.stickers.length; i++){
            $(this).append(
                '<div><img class="st-item-sticker" src="' + item.stickers[i] + '" style="margin-left: ' + (i * 25) + '%"></div>'
            )
        }

        $(this).data('st-loaded', true);
    })

    $('#st-load-prices').fadeOut(function(){
        $(this).text('Inventory: ' + Object.keys(infoPairs).length + ' items worth ' + formatPrice(inventory.total) + '!').fadeIn();
    })

    /* only load the sort buttons and expand buttons when all inventory items have been loaded */
    if(Object.keys(infoPairs).length == totalItems) {

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
        $('#st-sort-inventory-price').click(function () {
            sortInventory(true)
        });

        /* make everything fade in */
        $('.st-trade-offer-prices, .st-item-price, .st-item-float').hide().fadeIn();
    }
}

/* checks which inventory is active */
function isInventoryActive(appid, callback){
    injectScriptWithEvent(null, function(){
        window.dispatchEvent(new CustomEvent('%%event%%', {
            detail: g_ActiveInventory.appid
        }));
    }, callback)
}

/* get inventory from g_ActiveInventory rather than using a request to make
 the loading times faster */
function getActiveInventory(callback){
    injectScriptWithEvent({}, function(){
        /* clone javascript objects (http://stackoverflow.com/a/12690148/5631268)*/
        function copyObject(source, deep) {
            if (typeof source != 'object' || source === null) return source
            var o = new source.constructor(), prop, type;

            for (prop in source) {
                if (source.hasOwnProperty(prop)) {
                    type = typeof source[prop];
                    if (deep && type == 'object' && source[prop] !== null) {
                        o[prop] = copyObject(source[prop]);
                    } else {
                        o[prop] = source[prop];
                    }
                }
            }
            return o;
        }

        var _interval = setInterval(function(){
            if(g_ActiveInventory.rgItemElements !== null){
                clearInterval(_interval);

                var inventory = {};

                for(var i = 0; i < g_ActiveInventory.m_rgItemElements.length; i++){
                    var item = g_ActiveInventory.m_rgItemElements[i][0].rgItem;

                    /* all the elements are in the rgItemElements array, but the ones that haven't
                     loaded will be undefined, so we break and return the elements that have been loaded so far */
                    if(item == undefined) break;

                    inventory[item.assetid] = item.description;
                }

                window.dispatchEvent(new CustomEvent('%%event%%', {
                    detail: { inventory: inventory, steamID: g_ActiveInventory.m_owner.strSteamId, totalItems: g_ActiveInventory.m_rgItemElements.length }
                }));
            }
        }, 50)

    }, callback)
}

/* injects quick sell button */
injectScript({}, function(){
    window.PopulateMarketActions = function(elActions, item){
        elActions.update('');
        if(!item.marketable || (item.is_currency && CurrencyIsWalletFunds(item))){
            return elActions.hide()
        }

        var bIsTrading = typeof(g_bIsTrading) != 'undefined' && g_bIsTrading;

        if((typeof(g_bViewingOwnProfile) != 'undefined' && g_bViewingOwnProfile) || bIsTrading){
            var strMarketName = GetMarketHashName(item);

            var elPriceInfo = new Element('div');
            var elPriceInfoHeader = new Element('div', { 'style': 'height: 24px;' });

            var elMarketLink = new Element('a', {
                'href': 'https://steamcommunity.com/market/listings/' + item.appid + '/' + encodeURIComponent(strMarketName)
            });
            elMarketLink.update('View in Community Market');

            if(bIsTrading) Steam.LinkInNewWindow($J(elMarketLink));
            elPriceInfoHeader.appendChild(elMarketLink);
            elPriceInfo.appendChild(elPriceInfoHeader);

            var elPriceInfoContent = new Element('div', { 'style': 'min-height: 3em; margin-left: 1em;' });
            elPriceInfoContent.update('<img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif" alt="Working...">');
            elPriceInfo.appendChild(elPriceInfoContent);

            new Ajax.Request('https://steamcommunity.com/market/priceoverview/', {
                method: 'get',
                parameters: {
                    country: g_strCountryCode,
                    currency: typeof(g_rgWalletInfo) != 'undefined' ? g_rgWalletInfo['wallet_currency'] : 1,
                    appid: item.appid,
                    market_hash_name: strMarketName
                },
                onSuccess: function(transport) {
                    if (transport.responseJSON && transport.responseJSON.success){
                        var strInfo = '';
                        if(transport.responseJSON.lowest_price){
                            strInfo += 'Starting at: ' + transport.responseJSON.lowest_price + '<br>'

                            if(!bIsTrading){
                                /* lowest current listing price, take away 1 lowest denomination, e.g: £90 is 9000, so 9000 - 1 = £89.99 */
                                var quickSellPrice = GetPriceValueAsInt(transport.responseJSON.lowest_price) - 1

                                /* formatted version of the price, e.g: 9000 -> £90.00 */
                                var formattedQuickSellPrice = v_currencyformat(quickSellPrice, GetCurrencyCode(g_rgWalletInfo.wallet_currency), g_strCountryCode)

                                /* creates the button quick sell button */
                                var elQuickSellButton = CreateMarketActionButton('green', 'javascript:false', 'Quick Sell ' + formattedQuickSellPrice);

                                /* event for the quick sell, creates the ajax request */
                                $J(elQuickSellButton).click(function(){
                                    /* when making the request, we only send off the buyerPays value */
                                    var publisherFee = typeof(g_ActiveInventory.selectedItem.market_fee) == 'undefined' ? g_rgWalletInfo.wallet_publisher_fee_percent_default : g_ActiveInventory.selectedItem.market_fee
                                    var buyerPays = quickSellPrice - CalculateFeeAmount(quickSellPrice, publisherFee).fees

                                    /* save the element incase the selected item changes */
                                    var activeItemElement = $J(g_ActiveInventory.selectedItem.element)

                                    /* add the loading icon to the item */
                                    activeItemElement.append('<div class="st-item-quick-sold"><img class="st-item-quick-selling" src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>').hide().fadeIn();

                                    $J.ajax({
                                        url: 'https://steamcommunity.com/market/sellitem/',
                                        type: 'POST',
                                        data: {
                                            sessionid: g_sessionID,
                                            appid: g_ActiveInventory.selectedItem.appid,
                                            contextid: g_ActiveInventory.selectedItem.contextid,
                                            assetid: g_ActiveInventory.selectedItem.id,
                                            amount: 1,
                                            price: buyerPays
                                        },
                                        crossDomain: true,
                                        xhrFields: { withCredentials: true }
                                    }).done(function(data){
                                        var alertText = '';
                                        if(data.needs_mobile_confirmation){
                                            alertText = 'In order to list this item on the Community Market, you must verify the listing in your Steam Mobile app. You can verify it by launching the app and navigating to the Confirmations page from the menu.<br><br>If you don\'t see the Confirmations option in the main menu of the app, then make sure you have the latest version of the app.';
                                        } else {
                                            alertText = 'In order to list this item on the Community Market, you must complete an additional verification step.  An email has been sent to your address (ending in "%s") with additional instructions.'.replace(/%s/, data.email_domain);
                                        }

                                        //ShowAlertDialog('Additional confirmation needed', alertText);

                                        /* remove the loading icon which leaves a gray background */
                                        activeItemElement.find('.st-item-quick-selling').fadeOut();
                                    }).fail(function(jqXHR){
                                        /* jQuery doesn't parse JSON on failure */
                                        var data = JSON.parse(jqXHR.responseText);

                                        /* an error has occurred, just inform the user */
                                        ShowAlertDialog('An error occurred', (data && data.hasOwnProperty('message')) ? data.message : 'There was a problem listing your item. Refresh the page and try again.')

                                        /* remove the gray background and loading icon if it fails to list */
                                        activeItemElement.find('.st-item-quick-sold').fadeOut();
                                    });
                                })
                                elActions.appendChild($J(elQuickSellButton).css('margin-left', '10px')[0])
                            }

                        } else {
                            strInfo += 'There are no listings currently available for this item.' + '<br>';
                        }

                        if(transport.responseJSON.volume){
                            strInfo += 'Volume: ' + '%1$s sold in the last 24 hours'.replace('%1$s', transport.responseJSON.volume) + '<br>';
                        }

                        elPriceInfoContent.update(strInfo);
                    }
                },
                onFailure: function(transport){ elPriceInfo.hide() }
            });

            elActions.appendChild(elPriceInfo);

            if (!bIsTrading){
                var elSellButton = CreateMarketActionButton('green', 'javascript:SellCurrentSelection()', 'Sell');
                elActions.appendChild(elSellButton);
            }

            if (!g_bMarketAllowed){
                var elTooltip = $('market_tip_noaccess');
                InstallHoverTooltip( elSellButton, elTooltip );
            }
        } else {
            return elActions.hide()
        }

        elActions.show();
    }
})
