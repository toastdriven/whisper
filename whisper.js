// Whisper.js
// A light-weight blog in node.js.
// Requires:
//      http://github.com/ry/node_postgres.git
//      http://github.com/janl/mustache.js.git
// Licensed under the BSD.

/*
Setup:
#. Create the DB via ``createdb whisper``.
#. Run the following SQL against that db using ``psql whisper``.
    BEGIN;
    CREATE TABLE entries (
        id SERIAL,
        slug VARCHAR(50),
        title VARCHAR(255),
        tease VARCHAR(1000),
        body TEXT,
        created TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    COMMIT;
*/

// Change this to something unique!
var SECRET_PASSWORD = 't3ll_m3_4_s3kr3t';
var PORT = 8000;
var DB_NAME = 'whisper';

var author = 'Daniel Lindsley';
var version = [0, 1, 1];

var parse_date = require('./dates').parse_date;
var sql_date = require('./dates').sql_date;
var fs = require('fs');
var http = require('http');
var mustache = require('mustache');
var postgres = require('postgres');
var sys = require('sys');
var url = require('url');


var c = postgres.createConnection("host='' dbname="+DB_NAME);
c.mapTupleItems = true;


function render_to_response(context) {
  var base_html = fs.readFileSync('./base.html').toString();
  return mustache.to_html(base_html, context);
}

function process_entry(raw_row) {
  var refined = raw_row;
  try {
    var created = parse_date(raw_row.created);
    refined.created = created;
  }
  catch(err) {
    sys.debug('Got created error on '+raw_row.id+': '+err);
  }
  // sys.puts(sys.inspect(raw_row.created));
  return refined;
}


function show_list(request, response, matches) {
  var entries = [];
  c.query("SELECT * FROM entries ORDER BY created DESC LIMIT 5;", function (err, rows) {
    if (err) throw err;
    for(row in rows) {
      entries.push(process_entry(row));
    }
    sys.log('[200] GET '+request.url);
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write(render_to_response({'entries': rows}));
    response.end();
  });
}


function show_detail(request, response, matches) {
  var year = parseInt(matches[1]);
  var month = parseInt(matches[2]) - 1;
  var day = parseInt(matches[3]);
  var start_date = new Date(year, month, day);
  var end_date = new Date(year, month, day + 1);
  var slug = matches[4];
  var lookup_query = "SELECT * " + 
                     "FROM entries " +
                     "WHERE slug = '" + c.escapeString(slug) + "' " + 
                     "AND created >= '" + sql_date(start_date) + "' " + 
                     "AND created < '" + sql_date(end_date) + "' " + 
                     "LIMIT 1;"
  // sys.debug(lookup_query);
  c.query(lookup_query, function (err, rows) {
    if (err) throw err;
    if(rows.length <= 0) {
      show_404(request, response);
    }
    else {
      sys.log('[200] GET '+request.url);
      // sys.puts(JSON.stringify(rows[0]));
      entry = process_entry(rows[0]);
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.write(render_to_response({
        'entry': entry,
        'year': year,
        'month': month + 1,
        'day': day,
        'slug': slug
      }));
      response.end();
    }
  });
}


function show_404(request, response) {
  sys.log('[404] GET '+request.url);
  response.writeHead(404, {'Content-Type': 'text/html'});
  response.write(render_to_response({'error': "You seem to be trying to find something that isn't here."}));
  response.end();
}


http.createServer(function(request, response) {
  var urls = [
    ['^/$', show_list],
    ['^/(\\d{4})/(\\d{2})/(\\d{2})/([\\w\\d_.-]+)(/?)$', show_detail],
  ]
  var view_found = false;
  
  for(pattern_offset in urls) {
    var current_pattern = urls[pattern_offset];
    var url_regex = new RegExp(current_pattern[0]);
    
    if(request.url.match(url_regex)) {
      var matches = url_regex.exec(request.url);
      current_pattern[1](request, response, matches);
      view_found = true;
    }
  }
  
  if(!view_found) {
    show_404(request, response);
  }
}).listen(PORT);
sys.puts('Whisper running at http://localhost:'+PORT+'/...');
sys.puts('Ctrl-C to stop.')
