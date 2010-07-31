// Because Javascript's Date handling sucks.
exports.parse_date = parse_date;

function parse_date(date_string) {
  if(date_string == undefined || typeof(date_string.match) == undefined) {
    // Not a string. Die.
    throw("Provided date "+date_string+" is not a string.");
  }
  if(!date_string.match(/\d+-\d+-\d+/)) {
    // No date in the string?
    throw("Provided date "+date_string+" does not appear to have a date in it.");
  }
  
  // Kill off milliseconds (and likely timezone with it).
  var date_bits = date_string.split('.');
  
  if(date_bits.length < 1) {
    // Shouldn't happen.
    throw("Provided date "+date_string+" could not be parsed.");
  }
  
  var timestamp = Date.parse(date_bits[0]);
  // Convert to milliseconds.
  return Date(timestamp*1000);
}
