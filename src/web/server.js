const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const EC = require('elliptic').ec;
const BN = require('bn.js');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const sharp = require('sharp');
const multer = require('multer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data'); 
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const app = express();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });
const ec = new EC('secp256k1');

const uri = process.env.MONGO_URL;
const client = new MongoClient(uri);

let usersCollection;
const challenges = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [username, data] of challenges.entries()) {
    if (data.expiresAt < now) challenges.delete(username);
  }
}, 60 * 1000);

const MODEL_API = "http://127.0.0.1:8000/predict";

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(bodyParser.json());

async function initDB() {
  /*await client.connect();
  const db = client.db("sonarDB");
  usersCollection = db.collection("login_info");
  console.log("Connected to MongoDB!"); */
}

app.post('/login/challenge', async (req, res) => {
  try {
    const { username, R } = req.body;
    if (!username || !R) return res.status(400).json({ error: 'Missing username or R' });

    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(400).json({ error: 'No such user' });

    ec.keyFromPublic(R, 'hex').getPublic();
    const c = new BN(crypto.randomBytes(32)).toString('hex');
    challenges.set(username, { R, c, expiresAt: Date.now() + 60000 });
    res.json({ c });
  } catch (err) {
    res.status(500).json({ error: 'Challenge generation failed' });
  }
});

app.post('/login/verify', async (req, res) => {
  try {
    const { username, s } = req.body;
    if (!username || !s) return res.status(400).json({ error: 'Missing username or s' });

    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(400).json({ error: 'No such user' });

    const secret = challenges.get(username);
    if (!secret) return res.status(400).json({ error: 'Challenge expired or not found' });

    challenges.delete(username);

    const R = ec.keyFromPublic(secret.R, 'hex').getPublic();
    const pub = ec.keyFromPublic(user.pub, 'hex').getPublic();
    const c = new BN(secret.c, 16);
    const sBN = new BN(s, 16);

    const sG = ec.g.mul(sBN);
    const cY = pub.mul(c);
    const v = sG.add(cY.neg());

    const valid = v.eq(R);

    if (!valid) {
      return res.status(401).json({ error: 'Login failed' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ status: 'Login successful', token });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/verify-token', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await usersCollection.findOne({ username: decoded.username });
    if (!user) return res.status(400).json({ error: 'User not found' });

    res.json({ valid: true, username: decoded.username });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

app.get('/user/image/:name', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    const { username } = jwt.verify(token, JWT_SECRET);

    const user = await usersCollection.findOne(
      { username },
      { projection: { images: 1 } }
    );

    if (!user?.images) return res.status(404).send("No images");

    const img = user.images.find(i => i.name === req.params.name);
    if (!img) return res.status(404).send("Image not found");

    res.setHeader("Content-Type", img.mimetype);
    res.send(img.data.buffer);
  } catch (err) {
    res.status(500).send("Error downloading image");
  }
});

app.get('/user/images', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    let username;
    try {
      username = jwt.verify(token, JWT_SECRET).username;
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user = await usersCollection.findOne(
      { username },
      { projection: { images: 1, _id: 0 } }
    );

    if (!user || !user.images) return res.json({ images: [] });

    const latest = user.images
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, 15);

    res.json({
      images: latest.map(img => ({
        name: img.name,
        uploadedAt: img.uploadedAt,
        mimetype: img.mimetype,
        data: img.data ? img.data.toString("base64") : null
      }))
    });
  } catch (err) {
    console.error("Error fetching images:", err);
    res.status(500).json({ error: "Unable to fetch images" });
  }
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    let username;
    try {
      username = jwt.verify(token, JWT_SECRET).username;
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const buffer = await sharp(req.file.buffer)
      .resize(224, 224)
      .toBuffer();

    const name = req.body.name?.split('.')[0] || `img_${Date.now()}`;

    await usersCollection.updateOne(
      { username },
      {
        $setOnInsert: { username },
        $push: {
          images: {
            name,
            data: buffer,
            mimetype: req.file.mimetype,
            uploadedAt: new Date()
          }
        }
      },
      { upsert: true }
    );

    const formData = new FormData();
    formData.append("file", buffer, {
      filename: `${name}.jpg`,
      contentType: "image/jpeg"
    });

    const response = await fetch(MODEL_API, {
      method: "POST",
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("MODEL API FAILED:");
      console.error(errText);
      return res.status(500).json({ error: "Model API failed", details: errText });
    }

    const prediction = await response.json();

    res.json({
      message: `Image '${name}' saved under user '${username}'`,
      model_prediction: prediction
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Error uploading or predicting image" });
  }
});

app.delete("/user/image/:name", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    const { username } = jwt.verify(token, JWT_SECRET);
    const name = req.params.name;

    await usersCollection.updateOne(
      { username },
      { $pull: { images: { name } } }
    );

    res.json({ deleted: true, name });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

app.delete("/user/images", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    const { username } = jwt.verify(token, JWT_SECRET);

    await usersCollection.updateOne(
      { username },
      { $set: { images: [] } }
    );

    res.json({ deleted: true });
  } catch (err) {
    console.error("Delete ALL error:", err);
    res.status(500).json({ error: "Failed to delete all images" });
  }
});

initDB().then(() => {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});