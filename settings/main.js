$(document).ready(function(){
    $('.scrollspy').scrollSpy();
    $('#toc').pushpin({top: 350});
})

chrome.storage.sync.get(function(settings){
  $('#floatDecimals').val(settings.hasOwnProperty('fvdecimals') ? settings.fvdecimals : 6)
  $('#auto-accept').prop('checked', settings.hasOwnProperty('autoaccept') ? settings.autoaccept : false)
  updateFloat();
  updateBackground();
})

var fv = String(Math.random());
$('#floatDecimals').on('change mousemove', updateFloat);
function updateFloat(){
  var decimals = Number($('#floatDecimals').val()) + 2;
  $('#example-float1').text(fv.substr(0, decimals));
  $('#example-float2').text(fv.substr(0, decimals) + ' 100%');
  $("#example-trade1 span").text(fv.substr(0, decimals));
  $("#example-trade2 span").text(fv.substr(0, decimals));
}

$('#itemsBackground').on('change mousemove', updateBackground);
function updateBackground(){
  $('#example-trade1').css('background-color', 'hsla(' + $('#itemsBackground').val() + ', 28%, 21%, 1)')
  $('#example-trade2').css('background-color', 'hsla(' + $('#itemsBackground').val() + ', 28%, 21%, 1)')
}

$('.save-btn').click(function(){
  chrome.storage.sync.set({
    'fvdecimals': Number($('#floatDecimals').val()),
    'autoaccept': $('#auto-accept').is(':checked'),
    'intradebg': Number($('#itemsBackground').val())
  });
})
