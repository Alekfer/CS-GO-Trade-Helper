$(document).ready(function(){
    $('.scrollspy').scrollSpy();
    $('#toc').pushpin({top: 350});
})

chrome.storage.sync.get(function(settings){
  $('#floatDecimals').val(settings.hasOwnProperty('fvdecimals') ? settings.fvdecimals : 6)
  $('#auto-accept').prop('checked', settings.hasOwnProperty('autoaccept') ? settings.autoaccept : false)
  updateFloat();
})

var fv = Math.random();
$('#floatDecimals').on('change mousemove', updateFloat);
function updateFloat(){
  $('#example-float1').text(fv.toFixed($('#floatDecimals').val()));
  $('#example-float2').text(fv.toFixed($('#floatDecimals').val()) + ' 100%');
}

$('.save-btn').click(function(){
  chrome.storage.sync.set({
    'fvdecimals': Number($('#floatDecimals').val()),
    'autoaccept': $('#auto-accept').is(':checked')
  });
})
