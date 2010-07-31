// Because Javascript's Date handling sucks.
exports.parse_date = parse_date;
exports.sql_date = sql_date;
exports.just_date = just_date;
exports.just_time = just_time;

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

function zero_pad(number, desired_length) {
  // Make sure it's a string.
  number = number+'';
  while(number.length < desired_length) {
    number = '0'+number;
  }
  return number;
}

function sql_date(date) {
  return just_date(date) + " " + just_time(date)
         " " + zero_pad(date.getHours(), 2) +
         ":" + zero_pad(date.getMinutes(), 2) +
         ":" + zero_pad(date.getSeconds(), 2);
}

function just_date(date) {
  return "" + date.getFullYear() +
         "-" + zero_pad((date.getMonth() + 1), 2) +
         "-" + zero_pad(date.getDate(), 2);
}

function just_time(date) {
  return "" + zero_pad(date.getHours(), 2) +
         ":" + zero_pad(date.getMinutes(), 2) +
         ":" + zero_pad(date.getSeconds(), 2);
}
