const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration de Multer pour gérer les fichiers
const upload = multer({ storage: multer.memoryStorage() });

// Configuration de Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Route de test
app.get("/api/hello", (req, res) => {
  res.status(200).send("Hello depuis le backend Node.js déployé sur Vercel !");
});

// ✅ Route pour la soumission de la commande
app.post("/api/checkout", async (req, res) => {
    const { formData, orderSummary } = req.body;
    if (!formData || !orderSummary) {
        return res
            .status(400)
            .json({ success: false, message: "Données de requête invalides" });
    }

    const { name, phone, email, postalCode, address } = formData;
    const { items, totalTTC } = orderSummary;

    const emailContent = `
        <h1>Nouvelle Commande Reçue</h1>
        <p><strong>Nom Complet:</strong> ${name}</p>
        <p><strong>Téléphone:</strong> ${phone}</p>
        <p><strong>Adresse E-mail:</strong> ${email}</p>
        <p><strong>Code Postal:</strong> ${postalCode}</p>
        <p><strong>Adresse Complète:</strong> ${address}</p>
        <br>
        <h2>Détails de la Commande</h2>
        <ul style="list-style-type: none; padding: 0;">
            ${items
              .map(
                (item) =>
                  `<li>${item.name} (${item.quantity}x) - ${(
                    item.price * item.quantity
                  ).toFixed(2)}€</li>`
              )
              .join("")}
        </ul>
        <p><strong>Total TTC:</strong> ${totalTTC}€</p>
    `;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: "Nouvelle Commande - Votre Boutique E-commerce",
        html: emailContent,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("E-mail de commande envoyé avec succès");
        res
            .status(200)
            .json({ success: true, message: "Commande soumise avec succès." });
    } catch (error) {
        console.error("Erreur lors de l'envoi de l'e-mail:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de l'envoi de la commande.",
        });
    }
});

// ✅ Route pour les demandes de devis du configurateur
app.post("/api/configurator-email", async (req, res) => {
    const configuredItem = req.body;

    if (!configuredItem) {
        return res
            .status(400)
            .json({ success: false, message: "Données de configuration invalides" });
    }

    const emailContent = `
        <h1>Nouvelle demande de devis personnalisé</h1>
        <p>Un client a utilisé le configurateur pour créer une enseigne.</p>
        <br>
        <h2>Détails de la configuration :</h2>
        <ul style="list-style-type: none; padding: 0;">
            <li><strong>Nom du produit:</strong> ${configuredItem.name}</li>
            <li><strong>Style:</strong> ${
              configuredItem.name.includes("lumineuse")
                ? "Lettres lumineuses"
                : "Lettres découpées"
            }</li>
            <li><strong>Prix estimé HT:</strong> ${configuredItem.price} MAD</li>
            <li><strong>Matériau:</strong> ${configuredItem.material}</li>
            <li><strong>Police:</strong> ${configuredItem.details.font}</li>
            <li><strong>Dimensions:</strong> ${configuredItem.details.height} x ${
        configuredItem.details.estimatedWidth
      }</li>
            <li><strong>Couleur Texte:</strong> ${
              configuredItem.details.textColor
            }</li>
            <li><strong>Couleur Fond:</strong> ${
              configuredItem.details.backgroundColor
            }</li>
            ${
              configuredItem.details.ledColor
                ? `<li><strong>Couleur LED:</strong> ${configuredItem.details.ledColor}</li>`
                : ""
            }
            ${
              configuredItem.details.intensity
                ? `<li><strong>Intensité:</strong> ${configuredItem.details.intensity}</li>`
                : ""
            }
            ${
              configuredItem.details.neonEffect
                ? `<li><strong>Effet Néon:</strong> ${configuredItem.details.neonEffect}</li>`
                : ""
            }
            <li><strong>Type de fixation:</strong> ${
              configuredItem.details.fixationType
            }</li>
            <li><strong>Options supplémentaires:</strong> ${
              configuredItem.details.additionalOptions || "Aucune"
            }</li>
        </ul>
    `;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `Demande de Devis Configurator - ${configuredItem.name}`,
        html: emailContent,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("E-mail de configuration envoyé avec succès");
        res
            .status(200)
            .json({ success: true, message: "Configuration soumise avec succès." });
    } catch (error) {
        console.error("Erreur lors de l'envoi de l'e-mail:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de l'envoi de la configuration.",
        });
    }
});

// ✅ Route pour les messages du formulaire de contact
app.post("/api/contact", async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({
            success: false,
            message: "Tous les champs obligatoires doivent être remplis.",
        });
    }

    const emailContent = `
        <h1>Nouveau message de contact</h1>
        <p>Vous avez reçu un nouveau message via le formulaire de contact de votre site web.</p>
        <br>
        <p><strong>Nom:</strong> ${name}</p>
        <p><strong>E-mail:</strong> ${email}</p>
        <p><strong>Téléphone:</strong> ${phone || "Non fourni"}</p>
        <p><strong>Sujet:</strong> ${subject}</p>
        <br>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
    `;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `Nouveau message: ${subject}`,
        html: emailContent,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("E-mail de contact envoyé avec succès");
        res
            .status(200)
            .json({ success: true, message: "Message envoyé avec succès." });
    } catch (error) {
        console.error("Erreur lors de l'envoi de l'e-mail:", error);
        res
            .status(500)
            .json({ success: false, message: "Erreur lors de l'envoi du message." });
    }
});

// ✅ NOUVEL ENDPOINT POUR LE FORMULAIRE DE DEVIS AVEC FICHIER
// 'upload.single('logoFile')' est un middleware de multer qui gère le fichier
app.post("/api/devis-request", upload.single("logoFile"), async (req, res) => {
    const { name, phone, email, postalCode, address, manufacturingProcess, photoMontage, projectDescription } = req.body;

    // Le fichier est disponible dans req.file
    const file = req.file;

    // Valider les données requises
    if (!name || !phone || !email || !postalCode || !manufacturingProcess) {
        return res.status(400).json({ success: false, message: 'Tous les champs obligatoires doivent être remplis.' });
    }

    let attachments = [];
    if (file) {
      attachments.push({
        filename: file.originalname,
        content: file.buffer, // Utilise le buffer du fichier en mémoire
        contentType: file.mimetype,
      });
    }

    const emailContent = `
        <h1>Nouvelle Demande de Devis</h1>
        <p>Une nouvelle demande de devis a été soumise via le formulaire de devis personnalisé.</p>
        <br>
        <h2>Informations du demandeur</h2>
        <p><strong>Nom Complet:</strong> ${name}</p>
        <p><strong>Téléphone:</strong> ${phone}</p>
        <p><strong>Adresse E-mail:</strong> ${email}</p>
        <p><strong>Code Postal:</strong> ${postalCode}</p>
        <p><strong>Adresse Complète:</strong> ${address || 'Non fournie'}</p>
        <br>
        <h2>Détails du projet</h2>
        <p><strong>Type d'enseigne:</strong> ${manufacturingProcess}</p>
        <p><strong>Photo montage souhaité:</strong> ${photoMontage === 'true' ? 'Oui' : 'Non'}</p>
        <p><strong>Description du projet:</strong> ${projectDescription || 'Aucune description fournie'}</p>
        <br>
        <p>Un fichier de logo a été joint à cet e-mail.</p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `Nouvelle Demande de Devis de ${name}`,
      html: emailContent,
      attachments: attachments,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('E-mail de demande de devis envoyé avec succès');
        res.status(200).json({ success: true, message: 'Demande de devis soumise avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'e-mail:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de la demande de devis.' });
    }
});


// ✅ Export de l'application pour Vercel
module.exports = app;