const Express = require('express');
const BodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;

var app = Express();

app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));

var userPassword = 'klousman';
var collection;

var CONNECTION_URL =
  'mongodb+srv://edjeong99:' + userPassword + '@cluster0-uamnw.mongodb.net/db1';

// Open listening port and create db connections ahead.
app.listen(3000, () => {
  MongoClient.connect(CONNECTION_URL, (error, clientConn) => {
    if (error) {
      console.log('DB create failed');
      throw error;
    }
    console.log('DB create success');
    // Interestingly, 'MongoClient.connect' does not connect to database.  Below '.db()' does.
    var connObj = clientConn.db('db1');

    console.log('DB connection success');
    collection = connObj.collection('user');
  });
});

app.get('/info', (request, response) => {
  var infoJson = collection.find();
  // console.log(infoJson);
  response.send(infoJson);
});
