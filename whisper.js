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
var version = [0, 2, 0];

var parse_date = require('./dates').parse_date;
var sql_date = require('./dates').sql_date;
var zero_pad = require('./dates').zero_pad;
var fs = require('fs');
var http = require('http');
var mustache = require('mustache');
var postgres = require('postgres');
var querystring = require('querystring');
var sys = require('sys');
var url = require('url');


var c = postgres.createConnection("host='' dbname="+DB_NAME);
c.mapTupleItems = true;


function render_to_response(context) {
  var base_html = fs.readFileSync('./base.html').toString();
  return mustache.to_html(base_html, context);
}


function show_404(request, response) {
  sys.log('[404] GET '+request.url);
  response.writeHead(404, {'Content-Type': 'text/html'});
  response.write(render_to_response({'error': "You seem to be trying to find something that isn't here."}));
  response.end();
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
    if(err) { throw err; }
    for(var row in rows) {
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
                     "LIMIT 1;";
  // sys.debug(lookup_query);
  c.query(lookup_query, function (err, rows) {
    if(err) { throw err; }
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


function slugify(stringy) {
  var converted = stringy.toLowerCase();
  converted = converted.replace(' ', '-');
  converted = converted.replace(/[^\w\d_.\-]/, '');
  converted = converted.slice(0, 50);
  
  if(converted[converted.length - 1] == '-') {
    converted = converted.slice(0, 49);
  }
  
  return converted;
}


function entry_url(date, slug) {
  var year = date.getFullYear();
  var month = zero_pad(parseInt(date.getMonth()) + 1, 2);
  var day = zero_pad(date.getDate(), 2);
  return '/'+year+'/'+month+'/'+day+'/'+slug;
}


function post_entry(request, response, matches) {
  if(request.method == 'POST') {
    var buffer = '';
    request.addListener('data', function(chunk) {
        buffer += chunk;
    });
    request.addListener('end', function() {
      var post_data = querystring.parse(buffer);
      var password = post_data.password;
      
      if(password != SECRET_PASSWORD) {
        show_404(request, response);
        return;
      }
      
      var title = post_data.title;
      var slug = slugify(post_data.slug || post_data.title);
      var tease = post_data.tease || '';
      var body = post_data.body;
      var created = new Date();
      var lookup_query = "INSERT INTO entries " +
                         "(title, slug, tease, body) " +
                         "VALUES (" +
                         "'" + c.escapeString(title) + "', " +
                         "'" + c.escapeString(slug) + "', " +
                         "'" + c.escapeString(tease) + "', " +
                         "'" + c.escapeString(body) + "'" +
                         ");";
      sys.debug(lookup_query);
      c.query(lookup_query, function (err, rows) {
        if(err) { throw err; }
        sys.log('[200] GET '+request.url);
        response.writeHead(302, {'Content-Type': 'text/html', 'Location': entry_url(created, slug)});
        response.end();
      });
    });
  }
  else {
    sys.log('[200] GET '+request.url);
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write(render_to_response({'new_entry': true}));
    response.end();
  }
}


http.createServer(function(request, response) {
  var urls = [
    ['^/$', show_list],
    ['^/(\\d{4})/(\\d{2})/(\\d{2})/([\\w\\d_.-]+)(/?)$', show_detail],
    ['^/post(/?)$', post_entry]
  ];
  var view_found = false;
  
  for(var pattern_offset in urls) {
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
sys.puts('Ctrl-C to stop.');
