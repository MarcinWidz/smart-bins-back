const express = require("express");
const mongoose = require("mongoose");
const {
  PermissionMiddlewareCreator,
  RecordCreator,
  RecordRemover,
  RecordsRemover,
} = require("forest-express-mongoose");
const { articles, accounts, articleaccounts } = require("../models");

const router = express.Router();
const permissionMiddlewareCreator = new PermissionMiddlewareCreator("articles");

// This file contains the logic of every route in Forest Admin for the collection articles:
// - Native routes are already generated but can be extended/overriden - Learn how to extend a route here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/routes/extend-a-route
// - Smart action routes will need to be added as you create new Smart Actions - Learn how to create a Smart Action here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/actions/create-and-manage-smart-actions

//J'importe cloudinary
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create a Account
router.post(
  "/articles",
  permissionMiddlewareCreator.create(),
  (request, response, next) => {
    const { body, query, user } = request;
    const recordCreator = new RecordCreator(articles);

    recordCreator
      .deserialize(body)
      .then(async (recordToCreate) => {
        return recordCreator.create(recordToCreate);
      })
      .then(async (record) => {
        let AllAccounts = await accounts.find();
        for (let i = 0; i < AllAccounts.length; i++) {
          let accounts_id = AllAccounts[i]._id;
          let newArticleAccount = await new articleaccounts({
            hasLike: false,
            canRead: true,
            articles_id: mongoose.mongo.ObjectId(record._id),
            accounts_id: mongoose.mongo.ObjectId(accounts_id),
          });
          await newArticleAccount.save();
        }
        return recordCreator.serialize(record);
      })
      .then((recordSerialized) => response.send(recordSerialized))
      .catch(next);
  }
);

// Update a Account
router.put(
  "/articles/:recordId",
  permissionMiddlewareCreator.update(),
  (request, response, next) => {
    // Learn what this route does here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/routes/default-routes#update-a-record
    next();
  }
);

// Delete a Account
router.delete(
  "/articles/:recordId",
  permissionMiddlewareCreator.delete(),
  (request, response, next) => {
    // Learn what this route does here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/routes/default-routes#delete-a-record
    const { params, query, user } = request;
    const recordRemover = new RecordRemover(articles);
    recordRemover
      .remove(params.recordId)
      .then(async () => {
        console.log(params.recordId);
        let articleAccounts = await articleaccounts.find({
          articles_id: mongoose.mongo.ObjectId(params.recordId),
        });
        for (let i = 0; i < articleAccounts.length; i++) {
          await articleAccounts[i].delete();
        }

        response.status(204).send();
      })
      .catch(next);
  }
);

// Get a list of articles
router.get(
  "/articles",
  permissionMiddlewareCreator.list(),
  (request, response, next) => {
    // Learn what this route does here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/routes/default-routes#get-a-list-of-records
    next();
  }
);

// Get a number of articles
router.get(
  "/articles/count",
  permissionMiddlewareCreator.list(),
  (request, response, next) => {
    // Learn what this route does here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/routes/default-routes#get-a-number-of-records
    next();
  }
);

// Get a Account
router.get(
  "/articles/\\b(?!count\\b):recordId",
  permissionMiddlewareCreator.details(),
  (request, response, next) => {
    // Learn what this route does here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/routes/default-routes#get-a-record
    next();
  }
);

// Export a list of articles
router.get(
  "/articles.csv",
  permissionMiddlewareCreator.export(),
  (request, response, next) => {
    // Learn what this route does here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/routes/default-routes#export-a-list-of-records
    next();
  }
);

// Delete a list of articles
router.delete(
  "/articles",
  permissionMiddlewareCreator.delete(),
  (request, response, next) => {
    // Learn what this route does here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/routes/default-routes#delete-a-list-of-records
    next();
  }
);

module.exports = router;
