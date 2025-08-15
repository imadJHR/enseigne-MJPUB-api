const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001; // Utilise le port de l'environnement ou 5001 par défaut

// --- Middleware ---
app.use(cors()); // Active le partage de ressources entre origines (CORS)
app.use(express.json()); // Analyse les corps de requête JSON

// --- Configuration de Multer pour les téléversements de fichiers ---
// Stocke les fichiers en mémoire pour le traitement
const upload = multer({ storage: multer.memoryStorage() });

// --- Configuration du transporteur Nodemailer ---
// Fonction pour créer et configurer le transporteur d'e-mails
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, // Votre adresse Gmail depuis le fichier .env
      pass: process.env.EMAIL_PASS, // Votre mot de passe d'application Gmail depuis le fichier .env
    },
  });
};

let transporter = createTransporter();

// Middleware pour vérifier si le service d'e-mail est disponible
const checkTransporter = (req, res, next) => {
  if (!transporter) {
    return res.status(503).json({
      success: false,
      message: "Le service d'e-mail est temporairement indisponible",
    });
  }
  next();
};

// --- Routes de l'API ---

// ✅ Route de test
app.get("/api/hello", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Le backend est opérationnel",
    services: {
      email: transporter ? "disponible" : "indisponible",
    },
  });
});

// ✅ Route de soumission de commande
app.post("/api/checkout", async (req, res) => {
  try {
    const { formData, orderSummary } = req.body;
    if (!formData || !orderSummary) {
      return res.status(400).json({
        success: false,
        message: "Données de la requête invalides",
      });
    }

    const { name, phone, email, postalCode, address } = formData;
    const { items, totalTTC } = orderSummary;

    const emailContent = `
      <h1>Nouvelle Commande Reçue</h1>
      <p><strong>Nom Complet :</strong> ${name}</p>
      <p><strong>Téléphone :</strong> ${phone}</p>
      <p><strong>Adresse E-mail :</strong> ${email}</p>
      <p><strong>Code Postal :</strong> ${postalCode}</p>
      <p><strong>Adresse Complète :</strong> ${address}</p>
      <br>
      <h2>Détails de la Commande</h2>
      <ul style="list-style-type: none; padding: 0;">
          ${items
            .map(
              (item) => `
            <li>${item.name} (${item.quantity}x) - ${(
                item.price * item.quantity
              ).toFixed(2)}€</li>
          `
            )
            .join("")}
      </ul>
      <p><strong>Total TTC :</strong> ${totalTTC}€</p>
    `;

    const mailOptions = {
      from: `Boutique Enseigne <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `Nouvelle Commande - ${name.substring(0, 30)}`,
      html: emailContent,
      replyTo: email,
    };

    await transporter.sendMail(mailOptions);
    console.log("E-mail de commande envoyé avec succès");

    res.status(200).json({
      success: true,
      message: "Commande soumise avec succès.",
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail :", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la soumission de la commande.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ✅ Route pour la demande de devis du configurateur
app.post("/api/configurator-email", checkTransporter, async (req, res) => {
  try {
    const configuredItem = req.body;

    if (!configuredItem || !configuredItem.name || !configuredItem.details) {
      return res.status(400).json({
        success: false,
        message: "Données de configuration invalides",
      });
    }

    const detailsHtml = Object.entries(configuredItem.details)
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
        return `<li><strong>${label} :</strong> ${value}</li>`;
      })
      .join("");

    const emailContent = `
      <h1>Nouvelle Demande de Devis Personnalisé</h1>
      <p>Un client a utilisé le configurateur pour créer une enseigne.</p>
      <br>
      <h2>Détails de la configuration :</h2>
      <ul style="list-style-type: none; padding: 0;">
          <li><strong>Nom du produit :</strong> ${configuredItem.name}</li>
          <li><strong>Prix estimé (HT) :</strong> ${
            configuredItem.price
          } €</li>
          <li><strong>Matériau :</strong> ${configuredItem.material}</li>
          ${detailsHtml}
      </ul>
      <br>
      <p><strong>Options supplémentaires :</strong> ${
        configuredItem.details.additionalOptions || "Aucune"
      }</p>
    `;

    const mailOptions = {
      from: `Configurateur Enseigne <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `Demande de Devis - ${configuredItem.name.substring(0, 50)}`,
      html: emailContent,
      replyTo: configuredItem.details.email || process.env.EMAIL_USER,
    };

    await transporter.sendMail(mailOptions);
    console.log("E-mail de configuration envoyé avec succès");

    res.status(200).json({
      success: true,
      message: "Configuration soumise avec succès.",
      data: {
        itemName: configuredItem.name,
        price: configuredItem.price,
      },
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail :", error);
    if (error.code === "ECONNECTION") {
      transporter = createTransporter(); // Recrée le transporteur en cas d'erreur de connexion
    }
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi de la configuration.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ✅ Route pour le formulaire de contact
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Tous les champs obligatoires doivent être remplis.",
      });
    }

    const emailContent = `
      <h1>Nouveau Message de Contact</h1>
      <p>Vous avez reçu un nouveau message depuis le formulaire de contact de votre site web.</p>
      <br>
      <p><strong>Nom :</strong> ${name}</p>
      <p><strong>E-mail :</strong> ${email}</p>
      <p><strong>Téléphone :</strong> ${phone || "Non fourni"}</p>
      <p><strong>Sujet :</strong> ${subject}</p>
      <br>
      <p><strong>Message :</strong></p>
      <p>${message}</p>
    `;

    const mailOptions = {
      from: `Formulaire de Contact <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `Nouveau Message : ${subject.substring(0, 50)}`,
      html: emailContent,
      replyTo: email,
    };

    await transporter.sendMail(mailOptions);
    console.log("E-mail de contact envoyé avec succès");

    res.status(200).json({
      success: true,
      message: "Message envoyé avec succès.",
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail :", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du message.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ✅ Route pour le formulaire de devis avec téléversement de fichier
app.post("/api/devis-request", upload.single("logoFile"), async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      postalCode,
      address,
      manufacturingProcess,
      photoMontage,
      projectDescription,
    } = req.body;

    const file = req.file;

    if (!name || !phone || !email || !postalCode || !manufacturingProcess) {
      return res.status(400).json({
        success: false,
        message: "Tous les champs obligatoires doivent être remplis.",
      });
    }

    const attachments = file
      ? [
          {
            filename: file.originalname,
            content: file.buffer,
            contentType: file.mimetype,
          },
        ]
      : [];

    const emailContent = `
      <h1>Nouvelle Demande de Devis</h1>
      <p>Une nouvelle demande de devis a été soumise via le formulaire de devis personnalisé.</p>
      <br>
      <h2>Informations du demandeur</h2>
      <p><strong>Nom Complet :</strong> ${name}</p>
      <p><strong>Téléphone :</strong> ${phone}</p>
      <p><strong>Adresse E-mail :</strong> ${email}</p>
      <p><strong>Code Postal :</strong> ${postalCode}</p>
      <p><strong>Adresse Complète :</strong> ${address || "Non fournie"}</p>
      <br>
      <h2>Détails du projet</h2>
      <p><strong>Type d'enseigne :</strong> ${manufacturingProcess}</p>
      <p><strong>Photo montage souhaité :</strong> ${
        photoMontage === "true" ? "Oui" : "Non"
      }</p>
      <p><strong>Description du projet :</strong> ${
        projectDescription || "Aucune description fournie"
      }</p>
      <br>
      ${file ? "<p>Un fichier de logo a été joint à cet e-mail.</p>" : ""}
    `;

    const mailOptions = {
      from: `Demande Devis <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `Nouvelle Demande de Devis de ${name.substring(0, 30)}`,
      html: emailContent,
      attachments,
      replyTo: email,
    };

    await transporter.sendMail(mailOptions);
    console.log("E-mail de demande de devis envoyé avec succès");

    res.status(200).json({
      success: true,
      message: "Demande de devis soumise avec succès.",
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail :", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi de la demande de devis.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// --- Lancement du serveur ---
// Cette partie est pour le développement local. Vercel gère cela automatiquement.
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Le serveur tourne sur http://localhost:${PORT}`);
  });
}

// ✅ Exporte l'application pour Vercel
module.exports = app;