const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
require("dotenv").config();
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");
const nodemailer = require("nodemailer");
const isAuthenticated = require("./middlewares/isAuthenticated");

//import des modeles
const {
  accounts,
  articles,
  articleaccounts,
  addresses,
  bins,
  binsdeposits,
  bintypes,
  municipalities,
  tokens,
} = require("../models");

//vérifier que le mail n'existe pas en BDD avant de poursuivre l'inscription
router.get("/api/account/checkEmail/:mail", async (req, res) => {
  console.log("in the route : /api/utils/checkEmail/:mail");
  try {
    let mail = req.params.mail;
    let regex = new RegExp(mail, "i");
    //faire le traiement
    let account = await accounts.findOne({ email: regex });
    if (!account) {
      res.json({
        succeded: true,
        message:
          "Vous n'avez pas de compte, veuillez faire une demande d'inscription",
        data: [{ email: regex }],
      });
    } else {
      res.json({
        succeded: false,
        message: "Un compte est déjà enregistré avec cet email.",
        data: [],
      });
    }
  } catch (error) {
    console.log(error);
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques",
      data: [],
    });
  }
});

router.post("/api/account/resetPassword", async (req, res) => {
  console.log("in route : /api/account/resetPassword");
  try {
    //récupérer les données saisies

    if (req.body.is_trusted === "true") {
      let regex = new RegExp(req.body.email, "i");
      let account = await accounts.findOne({ email: regex });

      if (account) {
        if (req.body.newPassword) {
          let newSalt = uid2(16);
          let newHash = SHA256(newSalt + req.body.newPassword).toString(
            encBase64
          );
          let newToken = uid2(16);
          account.salt = newSalt;
          account.hash = newHash;
          account.token = newToken;
          await account.save();
          res.json({
            succeded: true,
            message: "Votre mot de passe a été mis à jour.",
            data: [],
          });
        } else {
          res.json({
            succeded: false,
            message: "Merci de renseigner un password.",
            data: [],
          });
        }
      } else {
        res.json({
          succeded: false,
          message: "Merci de valider votre mot de passe.",
          data: [],
        });
      }
    } else {
      res.json({
        succeded: false,
        message: "Merci de valider votre mot de email avec le code reçu.",
        data: [],
      });
    }
  } catch (error) {
    console.log(error);
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
});

router.post("/api/account/signup", async (req, res) => {
  console.log("In the router : /api/account/signup");
  let sendSubscriptionEmail = false;
  try {
    let body = req.body;
    let email = body.email;
    let password = body.password;
    let firstName = body.first_name;
    let lastName = body.last_name;
    let idRegion = body.id_region;
    let idMunicipality = body.id_municipality;
    let idAddress = body.id_addresses_id;
    let tokensIds = body.tokens_ids;

    if (
      email &&
      firstName &&
      lastName &&
      idAddress &&
      idRegion &&
      password &&
      idMunicipality
    ) {
      // les données sont renseignées
      if (
        typeof email === "string" &&
        typeof password === "string" &&
        typeof firstName === "string" &&
        typeof lastName === "string" &&
        typeof idRegion === "string" &&
        typeof idMunicipality === "string" &&
        typeof idAddress === "string"
      ) {
        // vérification de l'existence en base de l'adresse email
        let regex = new RegExp(email, "i");
        let account = await accounts.findOne({ email: regex });
        if (account) {
          //Compte utilisateur existant
          if (
            !account.first_name ||
            !account.last_name ||
            !account.addresses_id ||
            !account.tokens_ids ||
            !account.hash ||
            !account.salt ||
            !account.token
          ) {
            //inscription incomplète
            //Vérification de l'association des badges
            let allAccounts = await accounts.find({
              _id: { $ne: account._id },
            });
            let allDBTokens = allAccounts
              .map((e) => e.tokens_ids.map((e) => e.toString()))
              .flat(1); // merge des différentes array de tokens
            let tokensVerified = tokensIds.map((eT) =>
              allDBTokens.includes(eT)
            );
            console.log(
              "nombre badge redondants:",
              tokensVerified.reduce((r, e) => r + e, 0)
            );
            if (tokensVerified.reduce((r, e) => r + e, 0)) {
              // un des badges est déjà utilisé à l'utilisateur (différence avec l'utilisateur déjà inscrit)
              res.json({
                succeded: false,
                message: "Vos badges ne sont pas valides",
                data: [],
              });
            } else {
              // les badges sont valides et non utilisés
              // persistance des datas
              let salt = uid2(16);
              let token = uid2(16);
              let hash = SHA256(salt + password).toString(encBase64);
              console.log(
                "salt, password, token, hash:",
                salt,
                password,
                token,
                hash
              );
              account.first_name = firstName;
              account.last_name = lastName;
              account.addresses_id = mongoose.mongo.ObjectId(idAddress);
              account.tokens_ids = tokensIds.map((e) =>
                mongoose.mongo.ObjectId(e)
              );
              account.is_valide = false;
              account.hash = hash;
              account.salt = salt;
              account.token = token;
              await account.save();
              //email à envoyer
              sendSubscriptionEmail = true;
              res.json(account);
            }
          } else {
            //inscription complète
            if (!account.is_valide) {
              // demande est en cours de validation
              res.json({
                succeded: false,
                message:
                  "Vous avez déjà un compte qui est en cours de validation. Veuillez vous rapprocher de votre mairie.",
                data: [],
              });
            } else {
              // demande a été validée
              res.json({
                succeded: false,
                message:
                  "Ce compte a été approuvé, veuillez vous connecter directement.",
                data: [],
              });
            }
            // res.json(account);
          }
        } else {
          //Compte inexistant
          //Vérification de l'association des badges
          let allAccounts = await accounts.find();
          let allDBTokens = allAccounts
            .map((e) => e.tokens_ids.map((e) => e.toString()))
            .flat(1); // merge des différentes array de tokens
          let tokensVerified = tokensIds.map((eT) => allDBTokens.includes(eT));
          console.log(allDBTokens);
          console.log(
            "nombre badge redondants:",
            tokensVerified.reduce((r, e) => r + e, 0)
          );
          if (tokensVerified.reduce((r, e) => r + e, 0)) {
            // un des badges est déjà utilisé à l'utilisateur (différence avec l'utilisateur déjà inscrit)
            res.json({
              succeded: false,
              message: "Vos badges ne sont valides.",
              data: [],
            });
          } else {
            // les badges sont valides et non utilisés
            // persistance des datas
            let salt = uid2(16);
            let token = uid2(16);
            let hash = SHA256(salt + password).toString(encBase64);
            console.log(
              "salt, password, token, hash:",
              salt,
              password,
              token,
              hash
            );
            let newAccount = await new accounts({
              email: email,
              first_name: firstName,
              last_name: lastName,
              addresses_id: mongoose.mongo.ObjectId(idAddress),
              tokens_ids: tokensIds.map((e) => mongoose.mongo.ObjectId(e)),
              is_valide: false,
              hash: hash,
              salt: salt,
              token: token,
            });
            await newAccount.save();

            //liaison de toutes les articles au nouveau account
            let allArticles = await articles.find();
            for (let i = 0; i < allArticles.length; i++) {
              let articles_id = allArticles[i]._id;
              let newArticleAccount = await new articleaccounts({
                hasLike: false,
                canRead: true,
                articles_id: mongoose.mongo.ObjectId(articles_id),
                accounts_id: mongoose.mongo.ObjectId(newAccount._id),
              });
              await newArticleAccount.save();
            }

            //email à envoyer
            sendSubscriptionEmail = true;

            res.json(newAccount);
          }
        }
      } else {
        res.json({
          succeded: false,
          message:
            "L'ensemble des champs doivent être des chaînes de caractères.",
          data: [],
        });
      }
    } else {
      res.json({
        succeded: false,
        message: "L'ensemble des champs doivent être renseignés.",
        data: [],
      });
    }
    //envoie de mail à l'administrateur en cas d'une nouvelle inscription ou un update
    if (sendSubscriptionEmail) {
      //envoyer le mail
      try {
        const transporter = nodemailer.createTransport({
          port: 465, // true for 465, false for other ports
          host: "smtp.gmail.com",
          auth: {
            user: process.env.EMAIL_ADMIN,
            pass: process.env.EMAIL_PASSWORD,
          },
          secure: true,
        });

        const mailData = {
          from: process.env.EMAIL_ADMIN, // sender address
          to: process.env.EMAIL_ADMIN, // list of receivers
          subject: "Smart Bins - Nouvelle création de mail",
          html: `<b>Hello, </b>\
                 <br> Une nouvelle s'est inscrite avec les informations suivantes:  <br/>
                 <br> - email :  ${email}<br/>`,
        };

        console.log("mail data:", mailData);

        let response = await transporter.sendMail(mailData);
        console.log("response:", response);
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log("Error:", error);
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
});

router.post("/api/account/login", async (req, res) => {
  console.log("in /account/login");
  // console.log(req);
  // console.log(req.body);
  try {
    let email = req.body.email;
    let password = req.body.password;
    if (email && password) {
      if (typeof email === "string" && typeof password === "string") {
        try {
          let regex = new RegExp(email, "i");
          let account = await accounts.findOne({
            email: regex,
          });
          if (account) {
            //vérifier si l'administrateur a autorisé ce compte
            if (account.is_valide) {
              //compte approuvé par l'administrateur
              //   let salt = uid2(16);
              //   let token = uid2(16);
              //   let hash = SHA256(password + salt).toString(encBase64);
              // console.log(salt, hash, token);
              if (account.salt && account.hash) {
                let hash = SHA256(account.salt + password).toString(encBase64);
                if (account.hash === hash) {
                  //authentification réussie
                  // console.log(account._id);
                  res.json({
                    succeded: true,
                    message: "Authentification réussie.",
                    data: [
                      { account_id: account._id, account_token: account.token },
                    ],
                  });
                } else {
                  // echec d'authentification
                  res.json({
                    succeded: false,
                    message: "E-mail ou mot de passe erroné.",
                    data: [{ email: email, password: password }],
                  });
                }
              } else {
                // cas ou l'administrateur a créé le compte
                res.json({
                  succeded: false,
                  message: "Veuillez initialiser votre mot de passe.",
                  data: [{ email: email, password: password }],
                });
              }
            } else {
              //compte non approuvé par l'administrateur
              res.json({
                succeded: false,
                message:
                  "Votre de mande d'inscription est en cours d'approbation. Veuillez contacter votre mairie pour plus d'informations.",
                data: [{ email: email, password: password }],
              });
            }
          } else {
            res.json({
              succeded: false,
              message: "E-mail ou mot de passe erroné.",
              data: [{ email: email, password: password }],
            });
          }
          //   console.log(account);
          //   res.json({
          //     succeded: false,
          //     message: "E-mail ou mot de passe erroné.",
          //     data: [{ email: email, password: password }],
          //   });
        } catch (error) {
          console.log(error);
          res.json({
            succeded: false,
            message: "Problème technique.",
            data: [],
          });
        }
      } else {
        res.json({
          succeded: false,
          message:
            "L'e-mail et le mot de passe doivent être une chaîne de caractère.",
          data: [],
        });
      }
    } else {
      res.json({
        succeded: false,
        message: "E-mail ou mot de passe erroné.",
        data: [],
      });
    }
  } catch (error) {
    console.log("Error:", error);
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
});

const accessDashboard = async (req, res) => {
  console.log("in /api/account/consumptions");
  try {
    //delete account keys that we're not interestind in
    let account = { ...req.account }._doc;
    delete account.hash;
    delete account.salt;
    delete account.token;

    let tokensIds = req.account.tokens_ids.map((token) => token._id);
    console.log(tokensIds.map((e) => mongoose.mongo.ObjectId(e)));
    const binsDeposits4AuthenticatedAccount = await binsdeposits
      .find({
        tokens_id: tokensIds.map((e) => mongoose.mongo.ObjectId(e)),
      })
      .populate({
        path: "bins_id",
        populate: { path: "bintypes_id" },
      });

    console.log(Object.keys(binsDeposits4AuthenticatedAccount).length);

    if (binsDeposits4AuthenticatedAccount.length !== 0) {
      const type1 = [];
      const type2 = [];

      binsDeposits4AuthenticatedAccount.map((element) => {
        if (element.bins_id.bintypes_id.type === "OMR") {
          type1.push(element);
        } else {
          type2.push(element);
        }
      });

      type1.sort((a, b) => a.deposit_date - b.deposit_date);
      type2.sort((a, b) => a.deposit_date - b.deposit_date);

      let labelType1 = type1[0]?.bins_id.bintypes_id.type;
      let labelType2 = type2[0]?.bins_id.bintypes_id.type;
      if (!labelType1) {
        labelType1 = "OMR";
      }
      if (!labelType2) {
        labelType2 = "CSR";
      }

      //deposit from start to end_date for type1
      const startDate = new Date(req.body.start_date);
      const endDate = new Date(req.body.end_date);
      const depositType1 = [];
      type1.map((element) => {
        if (
          element.deposit_date > startDate &&
          element.deposit_date <= endDate
        ) {
          depositType1.push(element);
        }
      });

      //deposit from start to end_date for type2
      const depositType2 = [];
      type2.map((element) => {
        if (
          element.deposit_date > startDate &&
          element.deposit_date <= endDate
        ) {
          depositType2.push(element);
        }
      });

      //deposit from start to end
      const depositFromStart2End = {};
      depositFromStart2End[labelType1] = depositType1;
      depositFromStart2End[labelType2] = depositType2;

      //lastDeposit
      const lastDeposit = {};
      lastDeposit[labelType1] = type1[type1.length - 1];
      lastDeposit[labelType2] = type2[type2.length - 1];

      res.json({
        succeded: true,
        message: "Veuillez trouver les informations que vous avez demandées.",
        data: [
          {
            account: account,
            last_deposit: lastDeposit,
            depositFromStart2End: depositFromStart2End,
          },
        ],
      });
    } else {
      res.json({
        succeded: true,
        message: "Vous n'avez pas encore effectué de dépôts.",
        data: [
          {
            account: account,
          },
        ],
      });
    }
  } catch (error) {
    console.log("error:", error);
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
};

router.post("/api/account/consumptions/", isAuthenticated, accessDashboard);

const accessProfil = async (req, res) => {
  console.log("in /api/account/profil");

  //delete account keys that we're not interestind in
  let account = { ...req.account }._doc;
  delete account.hash;
  delete account.salt;
  delete account.token;

  res.json({
    succeded: true,
    message: "Veuillez trouver les informations que vous avez demandées.",
    data: [
      {
        account: account,
      },
    ],
  });
};
router.post("/api/account/profil/", isAuthenticated, accessProfil);

const modifyAccount = async (req, res) => {
  console.log("in /api/account/modify");
  try {
    let body = req.body;
    let id = body.id;
    let email = body.newEmail;
    let password = body.newPassword;
    let firstName = body.newFirstName;
    let lastName = body.newLastName;
    let idAddress = body.newId_addresses_id;
    let tokensIds = body.newTokens_ids;

    let account = await accounts.findOne({ _id: id });

    //modify email
    if (email) {
      let existingAccount = await accounts.findOne({ email: email });
      if (!existingAccount) {
        account.email = email;
        await account.save();
      } else {
        res.json({
          succeded: false,
          message: "Cette email n'est pas disponible.",
          data: [],
        });
      }
    }

    //modify password
    if (password) {
      let salt = uid2(16);
      let hash = SHA256(salt + password).toString(encBase64);
      let token = uid2(16);
      account.salt = salt;
      account.hash = hash;
      account.token = token;
      await account.save();
    }

    //modify firstName
    if (firstName) {
      account.first_name = firstName;
      await account.save();
    }

    //modify lastName
    if (lastName) {
      account.last_name = lastName;
      await account.save();
    }

    //modify id_addresses_id
    if (idAddress) {
      account.addresses_id = mongoose.mongo.ObjectId(idAddress);
      await account.save();
    }

    //modify tokensId
    if (tokensIds) {
      let allAccounts = await accounts.find({
        _id: { $ne: id },
      });
      let allDBTokens = allAccounts
        .map((account) => account.tokens_ids.map((id) => id.toString()))
        .flat(1); // merge des différentes array de tokens
      let tokensVerified = tokensIds.map((tokenId) =>
        allDBTokens.includes(tokenId)
      );
      if (!tokensVerified.reduce((r, e) => r + e, 0)) {
        account.tokens_ids = tokensIds.map((tokenId) =>
          mongoose.mongo.ObjectId(tokenId)
        );
        await account.save();
      } else {
        res.json({
          succeded: false,
          message: "Vos badges ne sont pas valides",
          data: [],
        });
      }
    }

    let accountResult = { ...account }._doc;
    delete accountResult.hash;
    delete accountResult.salt;

    res.json({
      succeded: true,
      message: "Profil modifié avec succès.",
      data: [
        {
          account: accountResult,
          email: email,
          password: password,
          firstName: firstName,
          lastName: lastName,
          idAddress: idAddress,
          tokensIds: tokensIds,
        },
      ],
    });
  } catch (error) {
    console.log(error.message);
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
};
router.post("/api/account/modify/", isAuthenticated, modifyAccount);

const accessFactureList = async (req, res) => {
  console.log("in /api/account/facture/:month");
  let month = Number(req.params.month);
  let id = req.body.id;
  let actualMonth = new Date().getMonth();
  let actualYear = new Date().getFullYear();

  try {
    let accountIdentified = await accounts.findOne({ _id: id }).populate({
      path: "bins_id",
      populate: { path: "bintypes_id" },
    });
    let accountResult = { ...accountIdentified }._doc;
    delete accountResult.hash;
    delete accountResult.salt;
    delete accountResult.token;

    let tokensIds = accountIdentified.tokens_ids.map((token) => token._id);
    let binsDeposits4Account = await binsdeposits
      .find({
        tokens_id: tokensIds.map((e) => mongoose.mongo.ObjectId(e)),
      })
      .populate({
        path: "bins_id",
        populate: { path: "bintypes_id" },
      });

    if (binsDeposits4Account.length !== 0) {
      const type1 = [];
      const type2 = [];
      const allDeposits = [];

      binsDeposits4Account.map((element) => allDeposits.push(element));
      //tableau de tous les deposits indépendamment du type de flux
      allDeposits.sort((a, b) => b.deposit_date - a.deposit_date);

      //combien de mois faut-il afficher ?
      let nMonth;
      if (
        allDeposits[allDeposits.length - 1].deposit_date.getFullYear() ===
        allDeposits[0].deposit_date.getFullYear()
      ) {
        nMonth =
          1 +
          allDeposits[0].deposit_date.getMonth() -
          allDeposits[allDeposits.length - 1].deposit_date.getMonth();
      } else {
        nMonth =
          1 +
          allDeposits[0].deposit_date.getMonth() +
          12 *
            (allDeposits[0].deposit_date.getFullYear() -
              allDeposits[allDeposits.length - 1].deposit_date.getFullYear() -
              1) +
          (12 - allDeposits[allDeposits.length - 1].deposit_date.getMonth());
      }

      //est-ce le mois en cours ?
      let moisEnCours = false;
      if (
        allDeposits[0].deposit_date.getMonth() === actualMonth &&
        allDeposits[0].deposit_date.getFullYear() === actualYear
      ) {
        moisEnCours = true;
      }

      //triage par type de flux
      let labelType1;
      let labelType2;
      binsDeposits4Account.map((element) => {
        if (element.bins_id.bintypes_id.type === "OMR") {
          labelType1 = element.bins_id.bintypes_id.type;
          type1.push(element);
        } else {
          labelType2 = element.bins_id.bintypes_id.type;
          type2.push(element);
        }
      });

      type1.sort((a, b) => b.deposit_date - a.deposit_date);
      type2.sort((a, b) => b.deposit_date - a.deposit_date);

      if (!labelType1) {
        labelType1 = "OMR";
      }
      if (!labelType2) {
        labelType2 = "CSR";
      }

      const deposit = {};
      deposit[labelType1] = type1.map((element) => element);
      deposit[labelType2] = type2.map((element) => element);

      let facture = {};
      let totalWeightType1 = 0;
      let totalWeightType2 = 0;
      let puType1 = 5;
      let puType2 = 7;
      let totalType1 = 0;
      let totalType2 = 0;
      let n = 0;

      let moisActuel = 0;
      let anneeActuel = 0;

      let lastDepositType1 = new Date("2001-01-01T00:00:00.000Z");
      let lastDepositType2 = new Date("2001-01-01T00:00:00.000Z");
      let mostRecentMonth;

      //si moisEnCous est false, je recherche le plus récent mois
      if (deposit[labelType1].length !== 0) {
        lastDepositType1 = deposit[labelType1][0].deposit_date.getMonth();
      }
      if (deposit[labelType2].length !== 0) {
        lastDepositType2 = deposit[labelType2][0].deposit_date.getMonth();
      }
      mostRecentMonth = Math.max(lastDepositType1, lastDepositType2);

      //convert :month in params in month et year number
      //améliorer le code pour n>=3
      let m = 0;
      if (moisEnCours) {
        m = actualMonth;
      } else {
        m = mostRecentMonth;
      }
      if (m - month + 1 >= 0) {
        moisActuel = m - month + 1;
        anneeActuel = actualYear;
      } else {
        if (m - month + 1 <= -1 && m - month + 1 > -13) {
          n = 1;
        }
        if (m - month + 1 <= -13 && m - month + 1 > -25) {
          n = 2;
        }
        if (m - month + 1 <= -25 && m - month + 1 > -37) {
          n = 3;
        }
        anneeActuel = actualYear - n;
        moisActuel = 12 * (actualYear - anneeActuel) - (month - m - 1);
      }

      //calcule le pois total pour chaque flux
      if (deposit[labelType1].length !== 0) {
        deposit[labelType1].map((element) => {
          if (
            moisActuel === element.deposit_date.getMonth() &&
            anneeActuel === element.deposit_date.getFullYear()
          ) {
            totalWeightType1 += element.weight;
          }
        });
        totalType1 = totalWeightType1 * puType1;
      }
      if (deposit[labelType2].length !== 0) {
        deposit[labelType2].map((element) => {
          if (
            moisActuel === element.deposit_date.getMonth() &&
            anneeActuel === element.deposit_date.getFullYear()
          ) {
            totalWeightType2 += element.weight;
          }
        });
        totalType2 = totalWeightType2 * puType2;
      }

      facture.total = Math.round(totalType1 + totalType2);
      facture[labelType1] = totalWeightType1;
      facture[labelType2] = totalWeightType2;
      facture.puType1 = puType1;
      facture.puType2 = puType2;

      res.json({
        succeded: true,
        message: "Veuillez trouver les informations que vous avez demandées.",
        data: [
          {
            actualMonth: moisEnCours,
            month_number: moisActuel,
            year_number: anneeActuel,
            nMonth: nMonth,
            facture: facture,
            account: accountIdentified,
          },
        ],
      });
    } else {
      res.json({
        succeded: true,
        message: "Vous n'avez pas encore effectué de dépôts.",
        data: [
          {
            account: accountResult,
          },
        ],
      });
    }
  } catch (error) {
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
};
router.post("/api/account/facture/:month", isAuthenticated, accessFactureList);

router.all("/api/account/*", (req, res) => {
  res.json({
    succeded: false,
    message: "Route introuvable",
    data: [],
  });
});

module.exports = router;
