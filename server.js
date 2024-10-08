const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors'); // Importation de CORS

// Initialiser Express
const app = express();
app.use(bodyParser.json());
app.use(cors()); // Activation de CORS pour permettre les requêtes cross-origin

// Connexion à MongoDB Atlas
mongoose.connect('mongodb+srv://Josue1:12345@cluster0.t1p9v.mongodb.net/clickupSync?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Modèle de l'entreprise (représentée par une tâche dans ClickUp)
const CompanySchema = new mongoose.Schema({
  clickUpId: String,
  name: String,
  description: String,
});

const Company = mongoose.model('Company', CompanySchema);

// Endpoint Webhook pour recevoir les événements de ClickUp
app.post('/webhooks/clickup', async (req, res) => {
  console.log('Webhook reçu:', JSON.stringify(req.body, null, 2)); // Log de la requête webhook reçue
  
  const event = req.body.event;
  const task = req.body.task;

  if (!task) {
    console.log("Erreur : la tâche n'est pas présente dans la requête");
    return res.status(400).send('Erreur : Pas de tâche dans la requête');
  }

  try {
    if (event === 'taskCreated') {
      const newCompany = new Company({
        clickUpId: task.id,
        name: task.name,
        description: task.description || '',
      });

      await newCompany.save();
      console.log('Nouvelle entreprise ajoutée:', newCompany);

    } else if (event === 'taskUpdated') {
      const company = await Company.findOneAndUpdate(
        { clickUpId: task.id },
        { name: task.name, description: task.description || '' },
        { new: true }
      );
      console.log('Entreprise mise à jour:', company);

    } else if (event === 'taskDeleted') {
      await Company.findOneAndDelete({ clickUpId: task.id });
      console.log('Entreprise supprimée:', task.id);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Erreur lors du traitement du webhook:', error);
    res.status(500).send('Erreur lors du traitement du webhook');
  }
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});



///////////////

// const express = require('express');
// const bodyParser = require('body-parser');
// const mongoose = require('mongoose');

// // Initialiser Express
// const app = express();
// app.use(bodyParser.json());

// // Connexion à MongoDB
// // mongoose.connect('mongodb://localhost:27017/clickupSync', { useNewUrlParser: true, useUnifiedTopology: true })
// mongoose.connect('mongodb+srv://Josue1:12345@cluster0.t1p9v.mongodb.net/clickupSync?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('MongoDB connecté'))
//   .catch(err => console.error(err));

// // Modèle de l'entreprise (représentée par une tâche dans ClickUp)
// const CompanySchema = new mongoose.Schema({
//   clickUpId: String,
//   name: String,
//   description: String,
// });

// const Company = mongoose.model('Company', CompanySchema);

// // Endpoint Webhook pour recevoir les événements de ClickUp
// app.post('/webhooks/clickup', async (req, res) => {
//   const event = req.body.event;
//   const task = req.body.task;

//   if (!task) {
//     console.log("Erreur : la tâche n'est pas présente dans la requête");
//     return res.status(400).send('Erreur : Pas de tâche');
//   }

//   try {
//     if (event === 'taskCreated') {
//       const newCompany = new Company({
//         clickUpId: task.id,
//         name: task.name,
//         description: task.description || '',
//       });

//       await newCompany.save();
//       console.log('Nouvelle entreprise ajoutée:', newCompany);
//     } else if (event === 'taskUpdated') {
//       const company = await Company.findOneAndUpdate(
//         { clickUpId: task.id },
//         { name: task.name, description: task.description || '' },
//         { new: true }
//       );
//       console.log('Entreprise mise à jour:', company);
//     } else if (event === 'taskDeleted') {
//       await Company.findOneAndDelete({ clickUpId: task.id });
//       console.log('Entreprise supprimée:', task.id);
//     }

//     res.status(200).send('OK');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Erreur lors du traitement du webhook');
//   }
// });

// // Démarrer le serveur
// app.listen(3000, () => {
//   console.log('Serveur en écoute sur le port 3000');
// });
