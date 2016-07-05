'use strict';
var htmlparser = require("htmlparser2"),
	CondVar = require("condvar2"),
	http = require("https");

module.exports = Book;

function Book(login, password, book_id, onlog){
	if (onlog) 
		this.onlog = onlog
	this.id = book_id;
	this.auth = '';
	this.fragments = [];
	this.getAuth (login, password);
	this.get();
}

function DS(e, g) {
    var b = [];
    b["~"] = "0", b["H"] = "1", b["^"] = "2", b["@"] = "3", b["f"] = "4", b["0"] = "5", b["5"] = "6",  b["n"] = "7";
    b["r"] = "8", b["="] = "9", b["W"] = "a", b["L"] = "b", b["7"] = "c", b[" "] = "d", b["u"] = "e",  b["c"] = "f";
    var f = [];
    var d = 0;
    for (var a = 0; a < g.length; a += 2) {
        f[d++] = b[g.substring(a, a + 1)] + b[g.substring(a + 1, a + 2)]
    }
    var ds =hex2utf8(f);
    return ds;
}

function hex2utf8(d) {
    var a = "";
	var b = 0, c = 0, c2 = 0, c3 = 0;
    while (b < d.length) {
        c = parseInt(d[b], 16) & 255;
        if (c < 128) {
            if (c < 16) {
                switch (c) {
                case 9:
                    a += " ";
                    break;
                case 13:
                    a += "\r";
                    break;
                case 10:
                    a += "\n";
                    break
                }
            } else {
                a += String.fromCharCode(c)
            }
            b++
        } else {
            if ((c > 191) && (c < 224)) {
                if (b + 1 < d.length) {
                    c2 = parseInt(d[b + 1], 16) & 255;
                    a += String.fromCharCode(((c & 31) << 6) | (c2 & 63))
                }
                b += 2
            } else {
                if (b + 2 < d.length) {
                    c2 = parseInt(d[b + 1], 16) & 255;
                    c3 = parseInt(d[b + 2], 16) & 255;
                    a += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63))
                }
                b += 3
            }
        }
    }
    return a
}

function base64_encode(h) {
    var e = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var d, b, a, n, m, l, j, o, g = 0, f = "";
    do {
        d = h.charCodeAt(g++);
        b = h.charCodeAt(g++);
        a = h.charCodeAt(g++);
        o = d << 16 | b << 8 | a;
        n = o >> 18 & 63;
        m = o >> 12 & 63;
        l = o >> 6 & 63;
        j = o & 63;
        f += e.charAt(n) + e.charAt(m) + e.charAt(l) + e.charAt(j)
    } while (g < h.length);switch (h.length % 3) {
        case 1:
            f = f.slice(0, -2) + "==";
            break;
        case 2:
            f = f.slice(0, -1) + "=";
            break
    }
    return f
}

var decrypt = function (str) {
    var dec =DS("1978thepasswhere", str);
	return dec;
};

function getNonce(){
	var cv = new CondVar;
	var options = {method: 'GET', host: 'zelluloza.ru', path: '/my'};
    
	http.request(options, function(response) {
    	var st = 0;
    	var parser = new htmlparser.Parser({
      		onopentag: function(name, attribs){
    			if(st == 0 && name === "form" && attribs.name === "logfrm") {
    	   			st = 1;
    	   		}
    	      	if(st == 1 && name == 'input' && attribs.name == 'nonce') {
//    				this.log(attribs.value);
    				cv.send(attribs.value);
    	        }
    	    }
       	}, {decodeEntities: true});
  		response.on('data', function (chunk) {
		    parser.write(chunk);
		});
		response.on('end', function () {
			parser.end();
		});
	}).end();
	var nonce = cv.recv();	
	return nonce;
}	

Book.prototype.getAuth = function (login, password) {
	if(login === '') {
		this.log('Authentication skipped. Using anonymous access.');
		return;
	}
	var cv = new CondVar;
	var body = 'login='+ encodeURIComponent(login)+'&nonce='+getNonce()+'&q=login&btnvalue=%D0%92%D0%BE%D0%B9%D1%82%D0%B8&password='+encodeURIComponent(password);
	var hdr = {'Content-Length': body.length, 'Content-Type': 'application/x-www-form-urlencoded'}
	var options = {method: 'POST', host: 'zelluloza.ru', path: '/', headers: hdr}

	var req = http.request(options, function(res) {
		cv.send(res.headers['set-cookie'][0].split(' ')[0])
	  }
	);
	req.write(body);
	req.end();
	this.auth = cv.recv();
    if(this.auth.startsWith('ze_hash=dummy')) {
        this.auth = '';
		this.log('Authentication failed. Using anonymous access.');
	} else {
		this.log('Authentication successful.');
	}
}

Book.prototype.get = function (){
	var cv = new CondVar;
	var book = this;
	var headers = {};
	if (this.auth !== '')
		headers.Cookie = this.auth;

	var options = {method: 'GET', host: 'zelluloza.ru', path: '/books/'+this.id, headers: headers};
	//this.log(JSON.stringify(this, null, '  '));
	var str = '';
	var bought = true;
	http.request(options, function(response) {
    	var st = 0;
		var href = '';
    	var parser = new htmlparser.Parser({
			onopentag: function(name, attribs) {
    			if(st == 0 && name === "meta" && attribs.itemprop === "description") {
					book.description = attribs.content;
//					this.log('desc: '+book.description);
				} else if(st == 2 && name === "meta" && attribs.itemprop === "name") {
//					this.log('title: '+attribs.content);
					book.title = attribs.content;
					st = 0;
				} else if(st == 0 && name === "meta" && attribs.property === "og:image") {
//					this.log('cover: '+attribs.content);
					book.cover = attribs.content;
					st = 0;
				} else if(st == 0 && name === "span" && attribs.itemprop === 'author') {
//					this.log('author: ...');
    	   			st = 1;
    	   		} else if(st == 1 && name == 'meta' && attribs.itemprop === 'name') {
//					this.log('author: '+attribs.content);
    				book.author = attribs.content;
					st = 0;
    	   		} else if(st == 0 && name == 'meta' && attribs.itemprop === 'dateModified') {
					st = 2;
    	   		} else if(st == 0 && name == 'a' && attribs.name === 'fragments') {
					st = 3;
    	   		} else if(st == 3 && name == 'a' && attribs['class'] === 'taglnk2' && attribs.href.startsWith('/books/'+book.id+'/') && attribs.href.endsWith('#page')) {
					st = 4;
					href = attribs.href;
    	        } else if(st == 3 && name == 'input' && attribs.type=='button')
                    if(attribs.class == 'bluesmbtn' && attribs.value == "Купить и читать"){
					bought = false;
				}
    	    },
			ontext: function(text){
				if(st == 4) {
					var f = new Fragment(href, text, book)
					if (bought == false) {
						f.bought = false;
					}
					bought = true;		
					book.fragments.push(f);
					href = '';
					st = 3;
				}
			},
			onclosetag: function (name){
                if(name === "body" || name === "html")
                    cv.send(true);
			},

       	}, {decodeEntities: true});
  		response.on('data', function (chunk) {
		    parser.write(chunk);
			str += chunk;
		});
		response.on('end', function () {
			parser.end();
		});
	}).end();
	var done = cv.recv();	
	if(this.title === undefined){
		var msg = 'Book '+this.id+' not found.'
		this.log(msg);
		return null;
	}
	this.log('Book: '+this.title);
	
	this.fragments.forEach(function (f) {
        f.prepare();
	});
	//this.log(JSON.stringify(book, null, '  '));
	this.buildXml();
}

function Fragment(href, title, book) {
	this.href = href;
	this.title = title; 
	this.book = book;
	this.auth = book.auth;
	this.init = '';
	this.ajaxCall = '';
	this.text = [];
	this.pages = [];
    this.settings = {PicsOnly: false};
	this.bought = true;
}

Fragment.prototype.prepare = function () {
    this.book.log(this.title);
    if(!this.bought) {
        this.text.push('Фрагмент недоступен');
        this.book.log('    Фрагмент недоступен');
        return;
    }
	var options = {	method: 'GET', host: 'zelluloza.ru', path: this.href, headers: { 'Cookie': this.auth }};
   	var st = 0;
    var cv = new CondVar;
	var f = this;
	var req = http.request(options, function(response) {
    	var parser = new htmlparser.Parser({
			onopentag: function(name, attribs){
				if(st == 0 && name === "script") st = 1;
    	    },
			onclosetag: function (name){
				if(st != 10) st = 0;
                if(name === "html")
                    cv.send(false);
			},
			ontext: function(text){
                //InitRead(0, 3, 0, '', 2, 1, 176, 1, 0);
                if(st == 1 && text.indexOf("InitRead(") > 0) {
                    text.split('\n').forEach(function (s) {
                        if(s.indexOf("InitRead(") > 0) {
                            st = 9;
                            f.init = s.trim();
                        }
                    });
                }
				if(st == 9 && text.indexOf("ajax('booktext', '', 'getbook'") > 0) {
					text.split('\n').forEach(function (s) {
						if(s.indexOf("ajax('booktext', '', 'getbook'") > 0) {
							st = 10;
                            f.ajaxCall = s.trim();
                            cv.send(true);
						}
					});
				}
			}
       	}, {decodeEntities: true});
  		response.on('data', function (chunk) {
		    parser.write(chunk);
		});
		response.on('end', function () {
			parser.end();

		});
	}).end();
    var done = cv.recv();
//	this.book.log(JSON.stringify(this, null, '  '));

    this.get();
}

var ajax = function (obj, notused, par1, par2, par3, par4, append) {
    var ret = {};
	ret.body = "op=" + encodeURIComponent(par1) + "&par1=" + encodeURIComponent(par2) + "&par2=" + encodeURIComponent(par3) + "&par4=" + encodeURIComponent(par4);
	ret.a = par3.split(':');
	ret.b = ret.a[1].split('.');
	//this.log(JSON.stringify(ret, null, '  '));
	return ret;
}

var InitRead = function (d, a, f, l, e, g, j, h, b) {
	var ret = {};
    ret.PicsOnly  = (e == 2);
    ret.NumPages = j;
	//this.log(JSON.stringify(ret, null, '  '));
	return ret;
};

Fragment.prototype.loadText = function () {
    var cv = new CondVar;
    var body = eval(this.ajaxCall).body;
    var hdr = {'Content-Length': body.length, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': this.auth};
    var options = {method: 'POST', host: 'zelluloza.ru', path: '/ajaxcall/', headers: hdr};
    var str = '';
    var f = this;
    var req = http.request(options, function (res) {
        res.on('data', function (chunk) {
            str += chunk;
        });
        res.on('end', function () {
            var strings = str.split("<END>")[0].split(/\n/);
            for (var i = 0; i < strings.length; i++) {
                var t = decrypt(strings[i]);
                if(!t.startsWith("[ctr][gry]"))
                f.text.push(t);
            }
            cv.send(true);
        });
    });
    req.write(body);
    req.end();
    var done = cv.recv();
}

Fragment.prototype.loadPages = function() {
    var ids = this.href.split('/');
    this.id = ids[3];
    for(var i = 0; i < this.settings.NumPages; i+=5) {
        var pageUrl = base64_encode(this.book.id + ":" + this.id + ":" + 5 /*pagessize*/ + ":" + i);
        var pageContent = this.book.getPic('https://zelluloza.ru/get/'+pageUrl);
        this.pages.push({url: pageUrl, content: pageContent});
        this.book.log(i + ': ' + pageUrl);
    }
}

Fragment.prototype.get = function () {
    if(this.ajaxCall === '') {
        this.text.push('Фрагмент недоступен');
        this.book.log('             Фрагмент недоступен')
        return;
    }
    this.settings = eval(this.init);
    if(this.settings && this.settings.PicsOnly)
        this.loadPages();
    else
        this.loadText();
}

Book.prototype.getPic = function (url) {
    var cv = new CondVar();
	var options = {method: 'GET', host: 'zelluloza.ru', path: url};
	var req = http.request(options, function(res) {
		res.setEncoding('binary');
		var data = [];
	    res.on('data', function(chunk) {
    	    data.push(new Buffer(chunk, 'binary'));
	    });
	    res.on('end', function() {
            var buf = Buffer.concat(data);
            //fs.writeFile(url.substring(url.lastIndexOf('/') + 1), buf, 'binary');
			cv.send(buf.toString('base64').match(/.{1,80}/g).join('\n'));
	    });
	    res.on('error', function(err) {
	        this.log("Error during HTTP request");
	        this.log(err.message);
	    });	
	}).end();
    return cv.recv();
}

Book.prototype.buildXml = function () {
	var author = this.author.split(' ');
	this.xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
 <description>
  <title-info>
   <genre>fantasy</genre>
   <author>
    <first-name>` + author[0] + `</first-name>
    <last-name>` + author[1] + `</last-name>
   </author>
   <book-title>`+this.title+`</book-title>
   <annotation>`;
	var pp = this.description.split('\n');
    for(var i = 0; i < pp.length; i++) 
		this.xml+='<p>' + pp[i] + '</p>';

    this.xml += `
</annotation>
   <coverpage>
    <image l:href="#cover.jpg"/></coverpage>
   <date>2016</date>
   <lang>ru</lang>
   <src-lang>ru</src-lang>
  </title-info>
 </description>
 <body>
 `;
    for(var i = 0; i < this.fragments.length; i++) {
        this.xml += `
<section><title><p>` + this.fragments[i].title + `</p></title>
`;
	    for(var j = 0; j < this.fragments[i].text.length; j++) 
			this.xml+='<p>' + this.fragments[i].text[j] + '</p>';

	    for(var j = 0; j < this.fragments[i].pages.length; j++) 
            this.xml += '<p><image l:href="#' + this.fragments[i].pages[j].url + '"/></p>\n';
        this.xml += `
</section>`;
    }
		this.xml+=`
</body>
<binary id="cover.jpg" content-type="image/jpeg">
`;
    this.xml+=this.getPic(this.cover);
	this.xml+="</binary>";
    for(var i = 0; i < this.fragments.length; i++) {
            for(var j = 0; j < this.fragments[i].pages.length; j++) {
                this.xml += '<binary id="' + this.fragments[i].pages[j].url + '" content-type="image/jpeg">';
                this.xml += this.fragments[i].pages[j].content;
                this.xml += '</binary>';
            };
    }
    this.xml+=`
</FictionBook>`;

}

Book.prototype.print = function () {
	var fs = require('fs');
	fs.appendFile('zelluloza-book-'+this.id+'.fb2', this.xml, 'utf8', null);
}

Book.prototype.log = function (msg) {
	if (this.onlog)
		this.onlog(msg);
	else
		console.log(msg);
}