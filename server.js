const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

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
  clickUpId: String, // ID de la tâche dans ClickUp pour assurer la synchronisation
  name: String,      // Nom de l'entreprise ou de la tâche
  description: String, // Description de l'entreprise ou de la tâche
});

const Company = mongoose.model('Company', CompanySchema);

// Fonction pour créer une tâche dans ClickUp
async function createTaskInClickUp(company) {
  try {
    const response = await axios.post('https://api.clickup.com/api/v2/list/901204709652/task', {
      name: company.name,
      description: company.description,
    //   status: 'to do' // Statut par défaut lors de la création
    }, {
      headers: {
        'Authorization': 'pk_2142013436_CWMVBRU0LW8NUEUT7EBDBOZO0NO2SFQY',
        'Content-Type': 'application/json',
      },
    });

    console.log('Tâche créée dans ClickUp:', response.data);
    return response.data.id; // Retourne l'ID de la tâche créée dans ClickUp
  } catch (error) {
    console.error('Erreur lors de la création de la tâche dans ClickUp:', error);
    throw error;
  }
}

// Fonction pour mettre à jour une tâche dans ClickUp
async function updateTaskInClickUp(company) {
  try {
    const response = await axios.put(`https://api.clickup.com/api/v2/task/${company.clickUpId}`, {
      name: company.name,
      description: company.description,
    }, {
      headers: {
        'Authorization': 'pk_2142013436_CWMVBRU0LW8NUEUT7EBDBOZO0NO2SFQY',
        'Content-Type': 'application/json',
      },
    });

    console.log('Tâche mise à jour dans ClickUp:', response.data);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la tâche dans ClickUp:', error);
    throw error;
  }
}

// Fonction pour supprimer une tâche dans ClickUp
async function deleteTaskInClickUp(clickUpTaskId) {
  try {
    await axios.delete(`https://api.clickup.com/api/v2/task/${clickUpTaskId}`, {
      headers: {
        'Authorization': 'pk_2142013436_CWMVBRU0LW8NUEUT7EBDBOZO0NO2SFQY',
        'Content-Type': 'application/json',
      },
    });

    console.log('Tâche supprimée dans ClickUp');
  } catch (error) {
    console.error('Erreur lors de la suppression de la tâche dans ClickUp:', error);
    throw error;
  }
}

// Endpoint pour créer une entreprise (synchro MongoDB -> ClickUp)
app.post('/companies', async (req, res) => {
  try {
    const newCompany = new Company(req.body);

    // Créer la tâche dans ClickUp
    const clickUpTaskId = await createTaskInClickUp(newCompany);

    // Enregistrer l'ID ClickUp dans MongoDB
    newCompany.clickUpId = clickUpTaskId;
    await newCompany.save();

    res.status(201).json(newCompany);
  } catch (error) {
    res.status(500).send('Erreur lors de la création de l\'entreprise');
  }
});

// Endpoint pour mettre à jour une entreprise (synchro MongoDB -> ClickUp)
app.put('/companies/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).send('Entreprise non trouvée');
    }

    // Mettre à jour les informations dans MongoDB
    Object.assign(company, req.body);
    await company.save();

    // Mettre à jour la tâche dans ClickUp
    await updateTaskInClickUp(company);

    res.status(200).json(company);
  } catch (error) {
    res.status(500).send('Erreur lors de la mise à jour de l\'entreprise');
  }
});

// Endpoint pour supprimer une entreprise (synchro MongoDB -> ClickUp)
app.delete('/companies/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).send('Entreprise non trouvée');
    }

    // Supprimer la tâche dans ClickUp
    await deleteTaskInClickUp(company.clickUpId);

    // Supprimer l'entreprise de MongoDB
    await company.remove();

    res.status(200).send('Entreprise supprimée');
  } catch (error) {
    res.status(500).send('Erreur lors de la suppression de l\'entreprise');
  }
});

// Endpoint Webhook pour recevoir les événements de ClickUp (synchro ClickUp -> MongoDB)
app.post('/webhooks/clickup', async (req, res) => {
  console.log('Webhook reçu:', JSON.stringify(req.body, null, 2)); 

  const event = req.body.event;
  const task = req.body.task;
  const historyItems = req.body.history_items;

  // Logs supplémentaires pour le traitement
  console.log("Event : ", event);
  console.log("Task : ", task);
  console.log("History Items : ", historyItems);

  if (!task) {
    console.log("Erreur : la tâche n'est pas présente dans la requête. Voici le contenu reçu : ", req.body);
    return res.status(400).send('Erreur : Pas de tâche dans la requête');
  }

  try {
    // Gestion des différents événements
    if (event === 'taskCreated' || event === 'taskStatusUpdated') {
      // Extraction des informations de l'historique
      const newCompany = new Company({
        clickUpId: task.id,
        name: task.name,
        description: task.description || '',
      });

      await newCompany.save();
      console.log('Nouvelle entreprise ajoutée:', newCompany);

    } else if (event === 'taskUpdated') {
      // Mise à jour de la tâche dans MongoDB
      const company = await Company.findOneAndUpdate(
        { clickUpId: task.id },
        {
          name: task.name,
          description: task.description || '',
        },
        { new: true }
      );
      console.log('Entreprise mise à jour:', company);

    } else if (event === 'taskDeleted') {
      // Suppression de la tâche dans MongoDB
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
