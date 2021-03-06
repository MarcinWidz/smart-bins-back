// This model was generated by Forest CLI. However, you remain in control of your models.
// Learn how here: https://docs.forestadmin.com/documentation/v/v6/reference-guide/models/enrich-your-models
const myMongoose = require("mongoose");

const schemaConfig = {
  first_name: { type: myMongoose.Schema.Types.String, required: true },
  last_name: { type: myMongoose.Schema.Types.String, required: true },
  email: { type: myMongoose.Schema.Types.String, required: true },
  hash: { type: myMongoose.Schema.Types.String },
  token: { type: myMongoose.Schema.Types.String },
  salt: { type: myMongoose.Schema.Types.String },
  is_valide: { type: myMongoose.Schema.Types.Boolean, required: false },
  avatar_uri: { type: myMongoose.Schema.Types.String },
  tokens_ids: [
    { type: myMongoose.Schema.Types.ObjectId, required: true, ref: "tokens" },
  ],
  addresses_id: {
    type: myMongoose.Schema.Types.ObjectId,
    required: true,
    ref: "addresses",
  },
  is_active: { type: myMongoose.Schema.Types.Boolean },
  start_activity_date: { type: myMongoose.Schema.Types.Date },
  end_activity_date: { type: myMongoose.Schema.Types.Date },
};
const schema = new myMongoose.Schema(schemaConfig);

function accountModel(mongoose, Mongoose) {
  return mongoose.model("accounts", schema, "accounts");
}

module.exports = accountModel;
