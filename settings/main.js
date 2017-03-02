/* TODO: should rewrite this all in Angular, not worth the effort right now though */

$(document).ready(function(){
    $('.scrollspy').scrollSpy();
    $('#toc').pushpin({top: 350});
})

/* get currency conversion rates */
var rates = {};
$.ajax({
    url: 'http://api.fixer.io/latest?base=USD',
    success: function(res){
        if(res && res.rates){
            /* the base is not included
             in the response, so we set it */
            res.rates.USD = 1;
            rates = res.rates;
        }
        updateSettings()
    }
})

/* set all the elements based on the user settings */
function updateSettings(){
    chrome.storage.sync.get(function(settings){
        $('#floatDecimals').val(settings.hasOwnProperty('fvdecimals') ? settings.fvdecimals : 6)
        $('#itemsBackground').val(settings.hasOwnProperty('intradebg') ? settings.intradebg : 180)
        $('#fontSizeTop').val(settings.hasOwnProperty('fontsizetop') ? settings.fontsizetop : 12)
        $('#fontSizeBottom').val(settings.hasOwnProperty('fontsizebottom') ? settings.fontsizebottom : 14)
        $('#autoAccept').prop('checked', settings.hasOwnProperty('autoaccept') ? settings.autoaccept : true)
        $('#exchange-' + (settings.hasOwnProperty('exchangeabbr') ? settings.exchangeabbr : 'USD')).prop('checked', true).change()
        $('#volume').val(settings.hasOwnProperty('volume') ? settings.volume : 100)
        $('#prices-' + (settings.hasOwnProperty('prices') ? settings.prices : 'backpack')).prop('checked', true).change()
        $('#autoIgnore').prop('checked', settings.hasOwnProperty('autoignore') ? settings.autoignore : true)
        $('#sounds-trigger').data('sound', settings.hasOwnProperty('sound') ? settings.sound : 'chime')
        updateFloat();
        updateBackground();
        updateFontSize();

        if(settings.hasOwnProperty('steamlytics')){
            $('label[for=prices-steamlytics]').attr('data-tooltip', 'API Key: ' + settings.steamlytics)
            $('.tooltipped').tooltip('remove');
            $('.tooltipped').tooltip({delay: 50})
        }
    })
}

/* set events for when the slider for the decimal places changes */
var fv = String(Math.random());
$('#floatDecimals').on('change mousemove', updateFloat);
function updateFloat(){
    var decimals = Number($('#floatDecimals').val()) + 2;
    $('#exampleFloatLeft').text(fv.substr(0, decimals));
    $('#exampleFloatRight').text(fv.substr(0, decimals) + ' 100%');
    $('.example-item-float:not(#exampleFloatRight)').text(fv.substr(0, decimals));
}

/* set events fro when the slider for the background color changes */
$('#itemsBackground').on('change mousemove', updateBackground);
function updateBackground(){
    $('#exampleTradeLeft').css('background-color', 'hsla(' + $('#itemsBackground').val() + ', 28%, 21%, 1)')
    $('#exampleTradeRight').css('background-color', 'hsla(' + $('#itemsBackground').val() + ', 28%, 21%, 1)')
}

/* set events for when the selected currency changes */
$('input:radio[name="exchange"]').on('change', updateCurrency);
function updateCurrency(){
    var curr = $(this).data('currency');
    $('#exchange').text(rates[curr] + ' ' + curr)

    /* update all other values on the page */
    var symbol = $('input:radio[name="exchange"]:checked').data('symbol')
    var price = rates[curr] * $('.example-item-price').data('price')
    $('.example-item-price').text(symbol + price.toFixed(2))
}

/* set events for when the font size slider is changed */
$('#fontSizeTop, #fontSizeBottom').on('change mousemove', updateFontSize);
function updateFontSize(){
    $('.example-item-float').css('font-size', $('#fontSizeTop').val() + 'px')
    $('.example-item-price, .example-item-wear').css('font-size', $('#fontSizeBottom').val() + 'px')
}

/* set events for when the volume slider changes */
$('#volume').on('mouseup', function(){
    /* when the volume is changed, replay the sound */
    playSound()
})

$('#sounds a').on('mouseup', function(){
    $('#sounds-trigger').data('sound', $(this).text())
    playSound()
})

function playSound(){
    var notificationSound = new Audio('../assets/' + $('#sounds-trigger').data('sound') + '.mp3')
    notificationSound.currentTime = 0
    notificationSound.volume = $('#volume').val() / 100
    notificationSound.play()
}

$('.save-btn').click(function(){
    saveSettings(false)
})

$('.default-btn').click(function(){
    saveSettings(true)
})

$('#prices-steamlytics').click(function(){
    chrome.storage.sync.get(function(settings) {
        var key = ""
        if(settings.hasOwnProperty('steamlytics')){
            key = settings.steamlytics
        }

        var key = prompt("Use of Steamlytics requires an API key that can be obtained from http://csgo.steamlytics.xyz/api\n\nIf you already have a key, enter it below:", key)
        if(key == null || key.length != 32){
            Materialize.toast("Invalid Steamlytics API key!")
            return $('input:radio[id=prices-backpack]').prop('checked', true)
        }

        $.ajax({
            url: 'http://api.steamlytics.xyz/v1/account?key=' + key,
            success: function(res){
                if(res && res.success && res.api_plan >= 2){
                    chrome.storage.sync.set({
                        steamlytics: key
                    })

                    $('label[for=prices-steamlytics]').attr('data-tooltip', 'API Key: ' + key)
                    $('.tooltipped').tooltip('remove');
                    $('.tooltipped').tooltip({delay: 50})
                } else {
                    $('input:radio[id=prices-backpack]').prop('checked', true);
                    Materialize.toast("Invalid Steamlytics API key!")
                }
            },
            error: function(){
                $('input:radio[id=prices-backpack]').prop('checked', true);
                Materialize.toast("Error whilst verifying Steamlytics API key.")
            }
        })
    })
})



function saveSettings(reset){
    Materialize.toast("Settings saved!", 2000);
    /* edit settings to default if requested, else save them */
    chrome.storage.sync.set({
        fvdecimals: reset ? 6 : Number($('#floatDecimals').val()),
        autoaccept: reset ? true : $('#autoAccept').is(':checked'),
        intradebg: reset ? 180 : Number($('#itemsBackground').val()),
        exchangeabbr: reset ? 'USD' : $('input:checked').data('currency'),
        exchangesymb: reset ? '$' : $('input:checked').data('symbol'),
        fontsizetop: reset ? 12 : $('#fontSizeTop').val(),
        fontsizebottom: reset ? 14 : $('#fontSizeBottom').val(),
        volume: reset ? 100 : $('#volume').val(),
        prices: reset ? 'backpack' : $('input:radio[name="prices"]:checked').data('prices'),
        autoignore: reset ? true : $('#autoIgnore').is(':checked'),
        sound: reset ? 'chime' : $('#sounds-trigger').data('sound')
    });

    /* if we're defaulting them, update them (responsive behaviour) */
    if(reset) updateSettings()

    chrome.runtime.sendMessage({action: 'updatePrices'});
}
