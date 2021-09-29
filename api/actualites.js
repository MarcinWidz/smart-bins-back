const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

//import des modeles
const {
  articles,
  accounts,
  articlecomments,
  articleaccounts,
} = require("../models");

const accessArticles = async (req, res) => {
  console.log("dans la route /actualités");
  let idAccount = req.params.idAccount;

  try {
    //à la recherche des articles de l'account
    let articleAccounts4Account = await articleaccounts.find({
      accounts_id: mongoose.mongo.ObjectId(idAccount),
      canRead: true,
    });

    let articles_ids = articleAccounts4Account.map((articleAccount) =>
      mongoose.mongo.ObjectId(articleAccount.articles_id)
    );
    let articles4Account = await articles.find({
      _id: articles_ids,
    });

    res.json({
      succeded: true,
      message: "Voici les articles correspondant à ce compte.",
      data: articles4Account,
    });
  } catch (error) {
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
};
router.get("/api/actualites/:idAccount", accessArticles);

const likerArticle = async (req, res) => {
  console.log("dans la route /api/actualites/article/liker");
  let idArticle = req.body.idArticle;
  let idAccount = req.body.idAccount;

  try {
    let article = await articles.findOne({
      _id: mongoose.mongo.ObjectId(idArticle),
    });
    let articleAccount = await articleaccounts.findOne({
      accounts_id: mongoose.mongo.ObjectId(idAccount),
    });

    if (!articleAccount.hasLike) {
      articleAccount.hasLike = true;
      article.likes++;
    } else {
      if (article.likes !== 0) {
        article.likes--;
        articleAccount.hasLike = false;
      }
    }
    await articleAccount.save();
    await article.save();
    res.json({
      succeded: true,
      message: "Effectué.",
      data: [article, articleAccount],
    });
  } catch (error) {
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
};
router.post("/api/actualites/article/liker", likerArticle);

const commentArticle = async (req, res) => {
  console.log("dans la route /api/actualites/article/commenter");
  let idArticle = req.body.idArticle;
  let idAccount = req.body.idAccount;
  let comment = req.body.comment;

  try {
    let article = await articles.findOne({
      _id: mongoose.mongo.ObjectId(idArticle),
    });
    let articleAccount = await articleaccounts.findOne({
      accounts_id: mongoose.mongo.ObjectId(idAccount),
    });
    let newArticleComment = await new articlecomments({
      articleaccounts_id: articleAccount._id,
      comment: comment,
    });
    await newArticleComment.save();
    console.log(newArticleComment);
    article.comments++;
    await article.save();
    res.json({
      succeded: true,
      message: "Effectué.",
      data: [article, newArticleComment],
    });
  } catch (error) {
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
};
router.post("/api/actualites/article/commenter", commentArticle);

const accessArticleComments = async (req, res) => {
  console.log("on est dans /api/actualites/articlecom/:idArticle");
  let idArticle = req.params.idArticle;

  try {
    let allArticleAccounts = await articleaccounts.find({
      articles_id: idArticle,
    });
    let allAccounts_ids = allArticleAccounts.map((e) =>
      mongoose.mongo.ObjectId(e.accounts_id)
    );
    let allArticleAccounts_ids = allArticleAccounts.map((e) =>
      mongoose.mongo.ObjectId(e._id)
    );
    let commentsTab = [];
    console.log(allArticleAccounts_ids);
    for (let i = 0; i < allArticleAccounts_ids.length; i++) {
      let ArticleComments = await articlecomments.find({
        articleaccounts_id: allArticleAccounts_ids[i],
        comment: { $ne: "" },
      });
      if (ArticleComments.length !== 0) {
        ArticleComments.map((e) => commentsTab.push(e));
      }
    }
    res.json({
      succeded: true,
      message: "Voici les commentaires de cette article.",
      data: [commentsTab],
    });
  } catch (error) {
    res.json({
      succeded: false,
      message: "Nous rencontrons des problèmes techniques.",
      data: [],
    });
  }
};
router.get("/api/actualites/articlecom/:idArticle", accessArticleComments);
router.all("/api/actualites/*", (req, res) => {
  res.json({
    succeded: false,
    message: "Route introuvable",
    data: [],
  });
});

module.exports = router;
