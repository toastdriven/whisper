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
var version = [0, 1, 0];

var parse_date = require('./date_parser').parse_date;
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
  sys.puts(sys.inspect(raw_row.created));
  return refined;
}


function show_list(request, response) {
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


function show_detail(request, response, slug) {
  c.query("SELECT * FROM entries WHERE slug = '"+c.escapeString(slug)+"' LIMIT 5;", function (err, rows) {
    if (err) throw err;
    if(rows.length < 0) {
      show_404(request, response);
    }
    else {
      sys.log('[200] GET '+request.url);
      sys.puts(JSON.stringify(rows[0]));
      entry = process_entry(rows[0]);
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.write(render_to_response({'entry': entry}));
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
  var path_bits = [];
  var parsed_url = url.parse(request.url, true);
  var path_bits = parsed_url['pathname'].split('/');
  
  if(path_bits[0] == '') {
    path_bits.shift();
  }
  
  if(path_bits.length > 0 && path_bits[path_bits.length - 1] == '') {
    path_bits.pop();
  }
  
  if(path_bits.length == 0) {
    show_list(request, response);
  }
  else if(path_bits[0] == 'favicon.ico') {
    show_404(request, response);
  }
  else if(path_bits.length == 1) {
    show_detail(request, response, path_bits[0]);
  }
  else {
    show_404(request, response);
  }
}).listen(PORT);
sys.puts('Whisper running at http://localhost:'+PORT+'/...');
sys.puts('Ctrl-C to stop.')
