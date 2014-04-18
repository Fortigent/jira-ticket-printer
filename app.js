var https = require("https"),
    querystring = require('querystring'),
    http = require('http'),
    fs = require('fs'),
    url = require('url'),
    host = process.env.JIRAHOST || "atlassian.net",
    port = process.env.JIRAPORT || 443,
    appPort = process.env.PORT || 8164;

function loadJira(usr, pwd, jql, done){
  var query = {jql: jql};
  var jqlString = JSON.stringify(query);
  var path = "/rest/api/latest/search?" + querystring.stringify(query);
  var req = https.request({
    hostname: host,
    port: port,
    path: path,
    method: "GET",
    auth: usr+":"+pwd,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": jqlString.length
    }
  }, function(result){
    result.setEncoding('utf-8');

    var responseString = '';

    result.on('data', function(data) {
      responseString += data;
    });

    result.on('end', function() {
      done(responseString);
    });
  });
  req.write(jqlString);
  req.end();
}

function fileHandler(contentType, res){
  return function (err, html) {
    if (err) {
      throw err;
    }
    res.writeHead(200, {'Content-Type': contentType});
    res.end(html);
  }
}

function handlePost(req, callback){
  var body = '';
  req.on('data', function (data) {
    body += data;
  });
  req.on('end', function () {
    var POST = querystring.parse(body);
    callback(POST);
  });
  return;
}

function isHttp(req){
  return req.headers['x-forwarded-proto'] === 'https' || req.headers['x-arr-ssl'];
}

http.createServer(function (req, res) {
  if (!isHttp(req) && process.env.NODE_ENV === 'production') {
    console.log('Request for login page made over HTTP, redirecting to HTTPS');
    res.writeHead(302, {
      'Location': 'https://' + req.headers.host + req.url
    });
    res.end();
    return;
  }

  if(req.url === "/"){
    req.url = "/index.html";
  }
  var root = "./app";
  var parsedUrl = url.parse(req.url);
  var htmlExpr = /.+\.html/g;
  var lessExpr = /.+\.less/g;
  var jsExpr = /.+\.js/g;
  var pngExpr = /.+\.png/g;

  if(htmlExpr.test(parsedUrl.path)){
    fs.readFile(root + parsedUrl.path, fileHandler('text/html', res));
    return;
  }
  if(lessExpr.test(parsedUrl.path)){
    fs.readFile(root + parsedUrl.path, fileHandler('text/less', res));
    return;
  }
  if(jsExpr.test(parsedUrl.path)){
    fs.readFile(root + parsedUrl.path, fileHandler('text/javascript', res));
    return;
  }
  if(pngExpr.test(parsedUrl.path)){
    fs.readFile(root + parsedUrl.path, fileHandler('image/png', res));
    return;
  }
  if(parsedUrl.pathname === "/search"){
    handlePost(req, function(data){
      loadJira(data.usr, data.pwd, data.jql, function(jiraJson){
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(jiraJson);
      });
    });
    return;
  }
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('404');
}).listen(appPort);
console.log('Server running on port ' + appPort);