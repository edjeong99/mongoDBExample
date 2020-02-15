//mongodb+srv://edjeong99:<password>@cluster0-uamnw.mongodb.net/db1

const Express = require('express');
const BodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;

var app = Express();

app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));

var VER = '0.0.0.5';
var VER_NOTE = '20-02-04: Added projection feature on find';

// ===================================================
//   NOTE:
//      1. do below db connection implementation -
//      2. add connPool status endpoint
//
//      "Managing connection (& pools)"":
//          - We should have once connection for each db?
//              Or is it OK to manage per cluster?
//              In internet, most of the talk suggestes one connection per db
//                  , which probably is easy/good to manage..
//              Before doing that, try db.connPoolStats().
//
//      "Downside of having large connection pool size":
//          - If the server does not have enough memory/cpu, it could kill the server.
//              Same for database.
//              However, if server/database can handle it, it is good to have it if the situation requires that large pool size.
//
//      Research about .connect(), .db()
//          - MongoClient.connect(url, option, callback) makes a connection to db (in a cluster) and return in callback.
//              .db() - Create a new Db instance sharing the current socket connections
// ===================================================

const POOL_SIZE = 1000;
var QUERY_LIMIT = 300; // SHOULD BE ABLE TO CHANGE IT

var CLUSTER_NAME_PRO = 'clusterpro';
var CLUSTER_NAME_DEV = 'clusterdev';
var CLUSTER_NAME_LOG = 'clusterlog';
var CLUSTER_NAME_OLD = 'clusterjames1';
var CLUSTER_NAME_VC = 'cVoucherCodes';

var userPassword = 'psiuser:PsiPass1234';

var CONNECTION_URL_PRO =
  'mongodb+srv://' +
  userPassword +
  '@' +
  CLUSTER_NAME_PRO +
  '-uvudw.mongodb.net/';
var CONNECTION_URL_DEV =
  'mongodb+srv://' +
  userPassword +
  '@' +
  CLUSTER_NAME_DEV +
  '-uvudw.mongodb.net/';
var CONNECTION_URL_LOG =
  'mongodb+srv://' +
  userPassword +
  '@' +
  CLUSTER_NAME_LOG +
  '-uvudw.mongodb.net/';
var CONNECTION_URL_OLD =
  'mongodb+srv://' +
  userPassword +
  '@' +
  CLUSTER_NAME_OLD +
  '-uvudw.mongodb.net/';
var CONNECTION_URL_VC =
  'mongodb+srv://' +
  userPassword +
  '@' +
  CLUSTER_NAME_VC +
  '-uvudw.mongodb.net/';

var CONN_OPTION_TAIL = '?retryWrites=true&w=majority';
var CONN_OPTION = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  poolSize: POOL_SIZE
};

// Create connections list..
var CONN_LIST_OBJ = {
  prod_client: { connObj: undefined, cluster: CONNECTION_URL_PRO, db: 'db1' },
  prod_log: { connObj: undefined, cluster: CONNECTION_URL_LOG, db: 'dbLog' },
  dev: { connObj: undefined, cluster: CONNECTION_URL_DEV, db: 'dev' },
  stage: { connObj: undefined, cluster: CONNECTION_URL_DEV, db: 'stage' },
  train: { connObj: undefined, cluster: CONNECTION_URL_DEV, db: 'train' },
  item: { connObj: undefined, cluster: CONNECTION_URL_OLD, db: 'db1' },
  voucherCodes: {
    connObj: undefined,
    cluster: CONNECTION_URL_VC,
    db: 'dbVoucherCodes'
  },
  voucherCodesDev: {
    connObj: undefined,
    cluster: CONNECTION_URL_VC,
    db: 'dbVCDev'
  }
}; // look with 'cluster' & 'db'.  If does not already exists, create one.

// 'collection' is obsolete...  <-- not used..
var MAPPING_ARRAY = [
  { stage: 'prod', item: 'client', connName: 'prod_client' },
  { stage: 'prod', item: 'log', connName: 'prod_log' },
  { stage: 'dev', item: '*', connName: 'dev' },
  { stage: 'stage', item: '*', connName: 'stage' },
  { stage: 'train', item: '*', connName: 'train' },
  { stage: 'item', item: '*', connName: 'item' },
  { stage: 'voucherCodes', item: '*', connName: 'voucherCodes' },
  { stage: 'voucherCodesDev', item: '*', connName: 'voucherCodesDev' }
];

var requestCount = 0;
var serverStartDT;

// Open listening port and create db connections ahead.
app.listen(3000, () => {
  serverStartDT = new Date();
  requestCount = 0;

  Util.ObjPropEach(CONN_LIST_OBJ, function(objectKey, index) {
    AppUtil.dbConnectCreate(objectKey, CONN_LIST_OBJ[objectKey]);
  });
});

app.get('/info', (request, response) => {
  var infoJson = {
    serverStartDT: serverStartDT,
    requestCount: requestCount,
    POOL_SIZE: POOL_SIZE,
    QUERY_LIMIT: QUERY_LIMIT,
    VER: VER,
    'VER NOTE': VER_NOTE
  };

  response.send(infoJson);
});

// TODO: Endpoint for connPoolStat
app.get('/connStat', (request, response) => {
  var dataJson = {};

  Util.ObjPropEach(CONN_LIST_OBJ, function(objectKey, index) {
    var thisObj = CONN_LIST_OBJ[objectKey];

    console.log('key: ' + objectKey);
    if (thisObj.connObj) {
      console.log(thisObj.connObj);
      //newObj.serverConfig = thisObj.connObj.serverConfig;
      //thisObj.connObj.runCommand( { "connPoolStats" : 1 } );
    }
  });

  response.send(dataJson);
});

// Backword compatible
app.post('/item', (request, response) => {
  requestCount++;
  //var startDateTime = new Date();

  AppUtil.getConnObj('item', '', MAPPING_ARRAY, CONN_LIST_OBJ, function(
    dbConn,
    dbDef
  ) {
    AppUtil.processDbColl(dbConn, 'client', request, response, 'item');
  });
});

app.post('/:stage/:item', (request, response) => {
  var stage = request.params.stage;
  var item = request.params.item;

  requestCount++;

  AppUtil.getConnObj(stage, item, MAPPING_ARRAY, CONN_LIST_OBJ, function(
    dbConn,
    dbDef
  ) {
    AppUtil.processDbColl(dbConn, item, request, response, stage + '/' + item);
  });
});

// -------------------------------------------
// -- App  Class/Methods

function AppUtil() {}

AppUtil.dbConnectCreate = function(connKeyName, dbSetting) {
  if (!dbSetting.connObj) {
    try {
      var clientConnStr = dbSetting.cluster + dbSetting.db + CONN_OPTION_TAIL;

      MongoClient.connect(clientConnStr, CONN_OPTION, (error, clientConn) => {
        if (error) {
          throw error;
        }

        // Interestingly, 'MongoClient.connect' does not connect to database.  Below '.db()' does.
        dbSetting.connObj = clientConn.db(dbSetting.db); //dbConn;

        console.log('CONNECTION: ' + connKeyName);
      });
    } catch (ex) {
      console.log('FAILED to connect: ' + connKeyName + '.  ERROR: ');
      console.log(ex);
    }
  }
};

AppUtil.getConnObj = function(
  stage,
  item,
  mappingArr,
  connListObj,
  returnFunc
) {
  try {
    for (var i = 0; i < mappingArr.length; i++) {
      var mappingObj = mappingArr[i];

      if (mappingObj.stage === stage) {
        if (mappingObj.item === '*' || mappingObj.item === item) {
          var foundConnDef = connListObj[mappingObj.connName];

          connObj = foundConnDef.connObj;

          returnFunc(foundConnDef.connObj, foundConnDef);
          return;
        }
      }
    }
  } catch (ex) {}

  returnFunc(null, null);
};

AppUtil.processDbColl = function(
  dbConn,
  collName,
  request,
  response,
  requestName
) {
  var errMsg = '';

  try {
    if (dbConn) {
      // dbDef &&
      var collection = dbConn.collection(collName);

      if (collection != undefined) {
        AppUtil.processData(request, response, collection);
        return;
      }
    } else
      errMsg =
        'FAILED.  Could Not find matching db connection for ' + requestName;
  } catch (ex) {
    errMsg = 'FAILED.  Error during Not proper case ' + requestName + ': ';
    if (ex && ex.message) errMsg += ex.message;
    else if (ex) errMsg += ex;
  }

  response.send({ errMsg: errMsg });
};
// ---------------------------------------------------------

AppUtil.processData = function(request, response, collection) {
  var startDateTime = new Date();

  if (request.body && request.body.mongoDB) {
    var mongoDB = request.body.mongoDB;
    var resultJson = {};

    // handler..  redirect...
    if (mongoDB.query) mongoDB.find = mongoDB.query;
    //if ( mongoDB.remove ) mongoDB.deleteOne = mongoDB.remove;
    //if ( mongoDB.delete ) mongoDB.deleteOne = mongoDB.delete;
    //if ( mongoDB.insert ) mongoDB.insertOne = mongoDB.insert;
    //if ( mongoDB.update ) mongoDB.updateOne = mongoDB.update;

    if (mongoDB.find) {
      Util.formatIdField(mongoDB.find);

      var queryLimit = QUERY_LIMIT;

      if (mongoDB.queryLimit) {
        queryLimit = Number(mongoDB.queryLimit);
      } else {
        resultJson.NOTE = 'Defult queryLimit of ' + QUERY_LIMIT + ' is used. ';
      }

      collection
        .find(mongoDB.find)
        .project(mongoDB.project)
        .limit(queryLimit)
        .sort(mongoDB.sort)
        .toArray((error, result) => {
          AppUtil.processResult(
            response,
            error,
            result,
            startDateTime,
            resultJson,
            mongoDB
          );
        });
    } else if (mongoDB.count) {
      Util.formatIdField(mongoDB.count);

      collection.find(mongoDB.count).count((error, result) => {
        AppUtil.processResult(
          response,
          error,
          result,
          startDateTime,
          resultJson,
          mongoDB
        );
      });
    }

    // NOTE: OBSOLETE!!
    else if (mongoDB.insert) {
      resultJson.NOTE =
        'insert command is OBSOLETE.  Used insertOne or insertMany instead.';

      collection.insert(mongoDB.insert, (error, result) => {
        AppUtil.processResult(
          response,
          error,
          result,
          startDateTime,
          resultJson
        );
      });
    } else if (mongoDB.insertOne) {
      collection.insertOne(mongoDB.insertOne, (error, result) => {
        AppUtil.processResult(
          response,
          error,
          result,
          startDateTime,
          resultJson
        );
      });
    } else if (mongoDB.insertMany) {
      collection.insertMany(mongoDB.insertMany, (error, result) => {
        AppUtil.processResult(
          response,
          error,
          result,
          startDateTime,
          resultJson
        );
      });
    }

    // 'update' Should be deprecated...
    else if (mongoDB.update) {
      resultJson.NOTE =
        'update command is OBSOLETE.  Used updateOne or updateMany instead.';
      var updateObj = mongoDB.update;

      // NOTE: this 'idenObj' name maybe better suited by 'find'?
      Util.formatIdField(updateObj.idenObj);

      collection.update(
        updateObj.idenObj,
        updateObj.updateData,
        (error, result) => {
          AppUtil.processResult(
            response,
            error,
            result,
            startDateTime,
            resultJson
          );
        }
      );
    } else if (mongoDB.updateOne) {
      var updateObj = mongoDB.updateOne;

      // NOTE: this 'idenObj' name maybe better suited by 'find'?
      Util.formatIdField(updateObj.idenObj);

      collection.updateOne(
        updateObj.idenObj,
        updateObj.updateData,
        (error, result) => {
          AppUtil.processResult(
            response,
            error,
            result,
            startDateTime,
            resultJson
          );
        }
      );
    } else if (mongoDB.updateMany) {
      var updateObj = mongoDB.updateMany;

      // NOTE: this 'idenObj' name maybe better suited by 'find'?
      Util.formatIdField(updateObj.idenObj);

      collection.updateMany(
        updateObj.idenObj,
        updateObj.updateData,
        (error, result) => {
          AppUtil.processResult(
            response,
            error,
            result,
            startDateTime,
            resultJson
          );
        }
      );
    } else if (mongoDB.remove) {
      resultJson.NOTE =
        'remove command is OBSOLETE.  Used deleteOne or deleteMany instead.';

      // Default for many delete...
      Util.formatIdField(mongoDB.remove.idenObj);

      collection.remove(mongoDB.remove.idenObj, (error, result) => {
        AppUtil.processResult(
          response,
          error,
          result,
          startDateTime,
          resultJson
        );
      });
    } else if (mongoDB.delete) {
      resultJson.NOTE = 'delete command is OBSOLETE.  Used deleteOne instead.';

      Util.formatIdField(mongoDB.delete.idenObj);

      collection.delete(mongoDB.delete.idenObj, (error, result) => {
        AppUtil.processResult(
          response,
          error,
          result,
          startDateTime,
          resultJson
        );
      });
    } else if (mongoDB.deleteOne) {
      var deleteObj = mongoDB.deleteOne;

      Util.formatIdField(deleteObj.idenObj);

      collection.deleteOne(deleteObj.idenObj, (error, result) => {
        AppUtil.processResult(
          response,
          error,
          result,
          startDateTime,
          resultJson
        );
      });
    } else if (mongoDB.deleteMany) {
      var deleteObj = mongoDB.deleteMany;

      Util.formatIdField(deleteObj.idenObj);

      collection.deleteMany(deleteObj.idenObj, (error, result) => {
        AppUtil.processResult(
          response,
          error,
          result,
          startDateTime,
          resultJson
        );
      });
    } else if (mongoDB.deleteNoRec) {
      // Not implemeted..
    }
  } else {
    response.send({
      query: request.query,
      body: request.body,
      note: 'Make sure payload body is JSON, not TEXT.'
    });
  }
};

AppUtil.processResult = function(
  response,
  error,
  result,
  startDateTime,
  resultJson,
  mongoDB
) {
  if (error) {
    response.status(500).send(error);
  } else {
    var diffTime = Util.getTimeDiff(startDateTime);

    resultJson.spent = diffTime.spent;
    resultJson.detailEnding = diffTime.detailEnding;

    // result
    if (mongoDB && mongoDB.find) {
      //if ( mongoDB.noContent === "Y" ) resultJson.itemCount = result.length;  // <-- Use 'count' instead..
      resultJson.dataList = result;
    } else if (mongoDB && mongoDB.count) {
      resultJson.count = result;
    } else {
      resultJson.result = result;
    }

    response.send(resultJson);
  }
};

// -------------------------------------------
// -- Utility Class/Methods

function Util() {}
//Util.termName_confirmed = ""; //

Util.getTimeDiff = function(startDateTime, endDateTime) {
  if (!endDateTime) endDateTime = new Date();

  var diffTime = {};

  diffTime.spent = (endDateTime.getTime() - startDateTime.getTime()) / 1000;
  diffTime.endDateTime = endDateTime;
  diffTime.detailEnding = ' At ' + endDateTime + ' , Req(' + requestCount + ')';

  // console.log( 'startTime: ' + Util.getTimeMS( startDateTime ) + " - endTime: " + Util.getTimeMS( endDateTime ) );
  //return ( ( endDateTime.getTime() - startDateTime.getTime() ) / 1000 ) + ' At ' + endDateTime + ' , Req(' + requestCount + ')';
  return diffTime;
};

Util.getTimeMS = function(date) {
  return date.getSeconds() + '.' + date.getMilliseconds();
};

Util.formatIdField = function(opObj) {
  if (opObj._id) {
    opObj._id = ObjectId(opObj._id);
  }
};

Util.ObjPropEach = function(obj, func) {
  Object.keys(obj).map(func);
};
