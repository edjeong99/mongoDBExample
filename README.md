# mongoDBExample

This is a personal project to learn MongoDB
mongo-ed.js is what I wrote.

API Endpoint

GET - /user - returns all document from user collection
GET - /user/:name - return document that match 'name' parameter
POST - /user - add a document to user collection.
        New document should be in the body of request
PUT  - user/:name - update document that match 'name' parameter
        Content that is updated should be in the body of request
DELETE - 