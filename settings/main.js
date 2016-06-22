$(document).ready(function(){
    $('.scrollspy').scrollSpy();
    $('#toc').pushpin({top: 350});
})

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

function updateSettings(){
  chrome.storage.sync.get(function(settings){
    $('#floatDecimals').val(settings.hasOwnProperty('fvdecimals') ? settings.fvdecimals : 6)
    $('#itemsBackground').val(settings.hasOwnProperty('intradebg') ? settings.intradebg : 180)
    $('#fontSizeTop').val(settings.hasOwnProperty('fontsizetop') ? settings.fontsizetop : 12)
    $('#fontSizeBottom').val(settings.hasOwnProperty('fontsizebottom') ? settings.fontsizebottom : 14)
    $('#autoAccept').prop('checked', settings.hasOwnProperty('autoaccept') ? settings.autoaccept : false)
    $('#exchange-' + (settings.hasOwnProperty('exchangeabbr') ? settings.exchangeabbr : 'usd')).prop('checked', true).change()
    updateFloat();
    updateBackground();
    updateFontSize();
  })
}

var fv = String(Math.random());
$('#floatDecimals').on('change mousemove', updateFloat);
function updateFloat(){
  var decimals = Number($('#floatDecimals').val()) + 2;
  $('#exampleFloatLeft').text(fv.substr(0, decimals));
  $('#exampleFloatRight').text(fv.substr(0, decimals) + ' 100%');
  $('.example-item-float:not(#exampleFloatRight)').text(fv.substr(0, decimals));
}

$('#itemsBackground').on('change mousemove', updateBackground);
function updateBackground(){
  $('#exampleTradeLeft').css('background-color', 'hsla(' + $('#itemsBackground').val() + ', 28%, 21%, 1)')
  $('#exampleTradeRight').css('background-color', 'hsla(' + $('#itemsBackground').val() + ', 28%, 21%, 1)')
}

$('input:radio').on('change', updateCurrency);
function updateCurrency(){
  var curr = $(this).data('currency');
  $('#exchange').text(rates[curr] + ' ' + curr)

  var symbol = $('input:checked').data('symbol')
  var price = rates[curr] * $('.example-item-price').data('price')
  $('.example-item-price').text(symbol + price.toFixed(2))
}

$('#fontSizeTop, #fontSizeBottom').on('change mousemove', updateFontSize);
function updateFontSize(){
  $('.example-item-float').css('font-size', $('#fontSizeTop').val() + 'px')
  $('.example-item-price, .example-item-wear').css('font-size', $('#fontSizeBottom').val() + 'px')
}

$('.save-btn').click(function(){
  chrome.storage.sync.set({
    'fvdecimals': Number($('#floatDecimals').val()),
    'autoaccept': $('#autoAccept').is(':checked'),
    'intradebg': Number($('#itemsBackground').val()),
    'exchangeabbr': $('input:checked').data('currency'),
    'exchangesymb': $('input:checked').data('symbol'),
    'fontsizetop': $('#fontSizeTop').val(),
    'fontsizebottom': $('#fontSizeBottom').val()
  });
})
