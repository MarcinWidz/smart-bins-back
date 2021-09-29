const express = require("express");
const router = express.Router();
require("dotenv").config();
const uid2 = require("uid2");
const nodemailer = require("nodemailer");

//import des modeles
const {
  accounts,
  addresses,
  bins,
  municipalities,
  tokens,
  binsdeposits,
  bintypes,
} = require("../models");

// validation mail passé en params et envoie code par mail
router.post(
  "/api/utils/generateMailCodeValidatorFor/:email",
  async (req, res) => {
    console.log(
      "in the route : /api/utils/generateMailCodeValidatorFor/:email"
    );
    try {
      let emailReceiver = req.params.email;
      // console.log("Email:", emailReceiver);
      if (typeof emailReceiver === "string") {
        let generatedCode = uid2(6).toUpperCase();
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
          to: emailReceiver, // list of receivers
          subject: "Smart Bins - validation de la demande de création",
          html: `<b>Hello, </b>\
                 <br> Voici votre code de validation :  ${generatedCode} .<br/>`,
        };

        // console.log("mail data:", mailData);

        let response = await transporter.sendMail(mailData);
        // console.log("response:", response);
        res.json({
          succeded: true,
          message: "Code envoyé",
          data: [
            { validation_code: generatedCode, email_receiver: emailReceiver },
          ],
        });
      } else {
        res.json({
          succeded: false,
          message: "L'email doit être une chaîne de caractères",
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
  }
);

//recherche token passé en params "76158EE4" par exemple
router.get("/api/utils/searchToken/:id", async (req, res) => {
  console.log("in the route : /api/utils/searchToken/:id");
  try {
    let idToken = req.params.id;
    if (typeof idToken === "string") {
      //faire le traiement
      let token = await tokens.findOne({ code: idToken });
      if (token) {
        res.json({
          succeded: true,
          message: "Badge valide",
          data: [{ tokenId: token._id }],
        });
      } else {
        res.json({
          succeded: false,
          message: "Badge invalide",
          data: [],
        });
      }
    } else {
      res.json({
        succeded: false,
        message: "Badge invalide",
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

//route recherche adresse "rue jean jacques rousseau" par exemple en autocompletion
router.get(
  "/api/utils/searchAddress/:regionCode/:municipalityCode/:addressToSearch",
  async (req, res) => {
    console.log(
      "in the : /api/searchAddress/:codeRegion/:municipalityCode/:addressToSearch"
    );
    try {
      let regionCode = req.params.regionCode;
      let municipalityCode = req.params.municipalityCode;
      let addressToSearch = req.params.addressToSearch;
      // console.log(regionCode, municipalityCode, addressToSearch);
      if (
        typeof regionCode === "string" &&
        typeof municipalityCode === "string" &&
        typeof addressToSearch === "string"
      ) {
        // console.log("here");
        let addresses = await municipalities
          .find({
            $and: [
              {
                departement_code: regionCode,
              },
              { postal_code: municipalityCode },
            ],
          })
          .populate("addresses_ids");

        if (addresses.length > 0) {
          let newAddresses = [];
          addresses.forEach((e) =>
            e.addresses_ids.forEach((e) => {
              if (
                e.street_name
                  .toLowerCase()
                  .includes(addressToSearch.toLowerCase()) ||
                e.house_number.includes(addressToSearch.toLowerCase())
              )
                newAddresses.push(e);
            })
          );

          let distinctAdresses = [];
          newAddresses.forEach((e1) => {
            let count = 0;
            distinctAdresses.forEach((e2) => {
              if (
                e1.street_name === e2.street_name &&
                e1.house_number === e2.house_number &&
                e1.post_code === e2.post_code
              ) {
                count = count + 1;
              }
            });
            if (count === 0) {
              distinctAdresses.push(e1);
            }
          });

          res.json({
            succeded: true,
            message: "Voici les villes adresses trouvées",
            data: distinctAdresses,
          });
        } else {
          res.json({
            succeded: false,
            message:
              "Nous ne sommes pas encore chez vous. Veuillez vous rapprocher de votre mairie.",
            data: [],
          });
        }
        console.log("here2");
      } else {
        res.json({
          succeded: false,
          message:
            "Le code du département, code postal, ou l'adresse recherchée ne sont pas des chaînes de caractères",
          data: [],
        });
      }
    } catch (error) {
      console.log("error:", error);
      res.json({
        succeded: false,
        message: "Nous rencontrons des problèmes techniques",
        data: [],
      });
    }
  }
);

//route recherche de communes "Issy-les-moulineaux" ou "92" en autocomplétion
router.get(
  "/api/utils/searchMunicipality/:regionCode/:municipalityToSearch",
  async (req, res) => {
    console.log(
      "route : /api/utils/searchMunicipality/:regionCode/:municipalityToSearch"
    );
    try {
      let wordToSearch = req.params.municipalityToSearch;
      let regionCode = req.params.regionCode;
      // console.log(req.params);
      // console.log(wordToSearch);
      // console.log(regionCode);
      if (typeof wordToSearch === "string" && typeof regionCode === "string") {
        //Rechercher la chaine de caractère dans la table et agréger les résultats
        let municipality = await municipalities.find({
          $and: [
            {
              departement_code: regionCode,
            },
            {
              $or: [
                { postal_code: new RegExp(wordToSearch, "i") },
                { name: new RegExp(wordToSearch, "i") },
              ],
            },
          ],
        });

        if (municipality.length > 0) {
          res.json({
            succeded: true,
            message: "Voici les villes trouvées",
            data: municipality.map((e) => {
              return {
                id: e._id,
                name: e.street_name,
                name: e.name,
                postal_code: e.postal_code,
                departement_code: e.departement_code,
                departement_name: e.departement_name,
              };
            }),
          });
        } else {
          res.json({
            succeded: false,
            message:
              "Nous ne sommes pas encore chez vous. Veuillez vous rapprocher de votre mairie.",
            data: [],
          });
        } //Retourner la réponse
      } else {
        // la chaine de caractère n'est pas un string
        res.json({
          succeded: false,
          message:
            "Le code du département ou le terme à rechercher ne sont pas des chaînes de caractères",
          data: [],
        });
      }
    } catch (error) {
      //erreur technique
      console.log(error);
      res.json({
        succeded: false,
        message: "Nous rencontrons des problèmes techniques",
        data: [],
      });
    }
  }
);

//route recherche département "92" ou "Hauts-de-seine" en autocomplétion
router.get("/api/utils/searchRegions/:wordToSearch", async (req, res) => {
  console.log("in utils/searchRegions");
  //récupere la liste des départements disponibles
  try {
    //récupérer le département demandé,
    //   let wordToSearch = req.body;
    // console.log(req.params.wordToSearch);

    let wordToSearch = req.params.wordToSearch;
    if (typeof wordToSearch === "string") {
      let municipality = await municipalities.aggregate([
        {
          $match: {
            $or: [
              { departement_name: new RegExp(wordToSearch, "i") },
              { departement_code: new RegExp(wordToSearch, "i") },
            ],
          },
        },
        {
          $group: {
            _id: { code: "$departement_code", name: "$departement_name" },
          },
        },
      ]);
      if (municipality.length > 0) {
        res.json({
          succeded: true,
          message: "Voici les départements trouvées",
          data: municipality.map((e) => e._id),
        });
      } else {
        res.json({
          succeded: false,
          message:
            "Nous ne sommes pas encore chez vous. Veuillez vous rapprocher de votre mairie.",
          data: [],
        });
      }
    } else {
      res.json({
        succeded: false,
        message: "Veuillez saisir une chaîne de caractères",
        data: [],
      });
    }
  } catch (error) {
    // erreur de requête ou de communication
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques",
      data: [],
    });
  }
});

router.all("/api/utils/*", (req, res) => {
  res.json({
    succeded: false,
    message: "Route introuvable",
    data: [],
  });
});

module.exports = router;
