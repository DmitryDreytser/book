var Book = require('./book');

//1003 - text, 1138  - pics
var book = new Book('login', 'password', 1003, function(msg) { console.log('MSG: '+msg)});
book.print();
