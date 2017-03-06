/* check if the user is verified */
getSteamID(true, function(steamID){
    checkVerification(steamID, function(response){
        if(response.success && response.verified){
            $('.profile_small_header_text').before('<div class="st-verified-profile st-verified-inv-page">' + response.name + '</div>')
            /* after adding the verification, move the name down a little to give it space */
            $('.profile_small_header_text').css('bottom', '25px')
        }
    })
})

injectScriptWithEvent({'%%lastId%%': $('.history_item.economy_item_hoverable').last().attr('id')}, function(){
    /* we need to redefine the function as we do below because the way the inventory history page
       is setup is that it fires `HistoryPageCreateItemHover` for every single item in the history
       and we keep gathering the parameters until the very last time the function is called,
       then we emit our own event in which we send off the data we've gathered and it's sent to
       be parsed (parseHistoryData) */

    var idMappings = {}
    HistoryPageCreateItemHover = function(id, appid, contextid, assetid, amount){
        CreateItemHoverFromContainer(g_rgHistoryInventory, id, appid, contextid, assetid, amount);

        /* we only care about cs:go right now so ensure the item is a cs:go one */
        if(appid != 730 && contextid != 2) return

        /* for compatibility with other games in the future, we won't hard code the app id
         and instead will use the one given in the function */
        idMappings[id] = g_rgHistoryInventory[730][2][assetid]

        if(id == '%%lastId%%'){
            window.dispatchEvent(new CustomEvent('%%event%%', {
                detail: idMappings
            }));
        }
    }

    /* fire the event again so we can run the HistoryPageCreateItemHover functions again */
    Event.fire(document, 'dom:loaded');
}, parseHistoryData)

function parseHistoryData(idMappings){
    /* in order to send our data through the `parseInventory` function, we need to send it through
       `replicateSteamResponse`, so we need to set up our idMappings to be compatible with the
       `replicateSteamResponse` function */
    var dataToReplicate = {}
    for(var elementId in idMappings){
        var item = idMappings[elementId]
        if(!item) continue
        dataToReplicate[item.id] = item
    }

    parseInventory('null', replicateSteamResponse({inventory: dataToReplicate}), function(infoPairs, idPairs){
        /* we now want to re build our idMappings (elementId: itemData) except using
           the new parsed item data */
        var newIdMappings = {}
        for(var elementId in idMappings){
            var item = idMappings[elementId]
            if(!item) continue
            newIdMappings[elementId] = infoPairs[item.id]
        }

        setupHistorySummaries(newIdMappings)
    })
}

function setupHistorySummaries(newIdMappings){
    /* newIdMappings is in the form { elementId: itemData } */

    /* loop over each trade in the history */
    $('.tradehistoryrow').each(function(){
        /* initialise our empty summary */
        var summary = {
            mine:     { items: 0, total: 0, types: {} },
            partner:  { items: 0, total: 0, types: {} }
        }

        /* loop over each history item inside the current trade */
        $(this).find('.economy_item_hoverable').each(function(){
            /* find the image and apply styling to make it look more aesthetically pleasing */
            $(this).find('img').css({
                'border-color': 'rgba(30, 52, 84, 0.62)',
                'box-shadow': 'inset 0px 0px 8px 1px rgb(0, 0, 0)',
                'padding': '2px',
                'background-color': 'rgb(27, 40, 56)'
            })

            /* instead of looping over our items and then our partner's and duplicating the code,
               we loop over each item, check the owner (id of the element will say received or given)
               and edit our summary info based on this */
            var owner = $(this).attr('id').indexOf('received') > -1 ? 'mine' : 'partner'

            /* if we're being given the items, it means images will be displayed, so apply
               styling to center them and make them look a little nicer, in our CSS we also apply
               syling to the scrollbar for these elements when the name overflows */
            if(owner == 'mine'){
                $(this).css({
                    'flex-basis': 'auto',
                    'width': '30%',
                    'overflow-y': 'overlay'
                })
            }

            /* if our item doesn't exist for some reason, we can't edit our summary info */
            var item = newIdMappings[$(this).attr('id')]
            if(item == null) return

            summary[owner].items += 1
            summary[owner].total += item.price ? item.price : 0
            if(!summary[owner].types[item.type]){
                summary[owner].types[item.type] = 1;
            } else {
                summary[owner].types[item.type] += 1;
            }
        })

        /* we want to loop over both keys in the summary and add the summary info box */
        var self = this;
        Object.keys(summary).forEach(function(key){
            /* work out which part of the trade this is (giving or receiving) */
            var className = key == 'mine' ? 'received' : 'given'
            var element = $(self).find('.tradehistory_items_' + className)

            element.css({
                'display': 'flex',
                'flex-wrap': 'wrap',
                'flex-direction': 'row',
                'justify-content': 'flex-start'
            })

            /* sort all of our items by price */
            var sorted = $(element).find('.history_item.economy_item_hoverable').sort(function(a, b) {
                var itemA = newIdMappings[$(a).attr('id')]
                if(itemA == null || !itemA.price) itemA.price = 0

                var itemB = newIdMappings[$(b).attr('id')]
                if(itemB == null || !itemB.price) itemB.price = 0
                return itemB.price - itemA.price
            })

            /* delete everything inside the parent (as there will be left over commas that initially
               separated each item */
            element.empty()

            /* append the plus or minus portion again as we removed it above, also if there are more
               than 3 items in this current history then make the plus/minus div take up the full width */
            var margin = sorted.length > 3 && className == 'received' ? '100' : 0
            element.append('<div style="margin-right: ' + margin + '%" class="tradehistory_items_plusminus">' + (className == 'received' ? '+' : '-') + '</div>')

            /* append the sorted elements, make them comma delimited only if we're not receiving items as we don't
               want to comma delimit items that have pictures (they will have flex box styling applied */
            sorted.appendTo(element).not(':last').after(key == 'mine' ? '' : ',&nbsp;');

            /* and finally append our actual summary box */
            element.after(
                '<div class="st-trade-offer-prices st-trade-offer-prices-history">' + formatPrice(summary[key].total) +
                '<div class="st-display-right">' + summary[key].items + ' ' + (summary[key].items > 1 ? 'items' : 'item') + '</div>' +
                buildItemSummary(summary[key].types)
            )

        })
    })
}

/* injection required to load sticker prices */
injectScriptWithEvent({}, stickerPriceInjection, stickerPriceCallback)