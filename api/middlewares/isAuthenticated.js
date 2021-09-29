const { accounts } = require("../../models");

const isAuthenticated = async (req, res, next) => {
  if (req.headers.authorization) {
    try {
      let account;
      if (req.body.id) {
        account = await accounts
          .findOne({
            _id: req.body.id,
          })
          .populate({ path: "tokens_ids addresses_id" });
      }
      if (req.body.email) {
        let regex = new RegExp(req.body.email, "i");
        account = await accounts
          .findOne({
            email: regex,
          })
          .populate({ path: "tokens_ids addresses_id" });
      }

      if (!account) {
        res.status(401).json({
          succeded: false,
          message: "Veuillez vous enregistrer.",
          data: [],
        });
      } else {
        if (
          account.token === req.headers.authorization.replace("Bearer ", "")
        ) {
          req.account = account;
          next();
        } else {
          res.status(401).json({
            succeded: false,
            message: "Veuillez vous authentifier.",
            data: [],
          });
        }
      }
    } catch (error) {
      res.json({
        succeded: false,
        message: "Nous rencontrons des problèmes techniques.",
        data: [],
      });
    }
  } else {
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
};

//export module
module.exports = isAuthenticated;
