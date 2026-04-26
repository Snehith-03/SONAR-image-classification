# Underwater SONAR Image Classification System

## Abstract
This project presents a full-stack web application for the classification of underwater SONAR images using deep learning techniques. The system integrates advanced explainable AI (XAI) methods to enhance interpretability and trust in predictions. It leverages a secure authentication mechanism based on Schnorr digital signatures and follows a modular design comprising the frontend interface, backend logic, and ML/database layer. The model utilized for classification is DenseNet121, with Grad-CAM++ and LIME providing visual and local explanations.

---

## 1. Introduction
The increasing demand for reliable underwater imaging analysis has driven the development of intelligent systems capable of classifying SONAR data. This project aims to provide a user-friendly and secure web-based solution that facilitates SONAR image classification, visualization, and explainability through deep learning models. Users can log in, upload SONAR images, and view both classification results and explanatory visualizations of model decisions.

---

## 2. System Architecture
The system architecture consists of three major layers: **Frontend**, **Backend**, and **ML/Database Layer**, as depicted in the figure below.

![System Architecture](./43478abc-87c1-4775-b713-9f01c08e6d30.png)

### 2.1 Frontend (React.js)
The frontend provides the user interface for interaction. It is developed using **React.js** with routing handled by React Router and styling via **Tailwind CSS**. The primary components include:
- **Login.jsx** – Handles user authentication via Schnorr challenge.
- **Sonar.jsx** – Enables image upload for classification.
- **Results.jsx** – Displays model predictions, confidence levels, and explanation maps.
- **History.jsx** – Shows a record of previous uploads and classification outcomes.

### 2.2 Backend (Node.js + Express.js)
The backend serves as the communication bridge between the frontend, machine learning API, and database. Its major responsibilities include authentication, image preprocessing, and result management.  
Modules include:
- **Authentication:** Manages Schnorr signature verification and JWT issuance.
- **History:** Queries and stores classification history.
- **Image Preprocessing:** Prepares SONAR images before forwarding them for inference.
- **ML/DB Communication:** Manages interactions with MongoDB and the ML inference API.

### 2.3 ML and Database Layer
The ML/Database layer integrates **MongoDB** for data persistence and a **Machine Learning Inference API** for prediction and explanation.

#### MongoDB
Stores user credentials, SONAR image metadata, classification results, and user history logs.

#### ML Inference API
Implements a pre-trained **DenseNet121** model optimized for SONAR data. The model provides both predictions and explanations using:
- **Grad-CAM++** – Generates heatmaps highlighting influential regions.
- **LIME** – Produces local feature importance for interpretability.

---

## 3. Authentication Mechanism
Authentication is implemented using the **Schnorr digital signature scheme**, ensuring mathematical verification of user authenticity. After verification, users receive a **JWT (JSON Web Token)** for secure session management. This dual-layered approach enhances system integrity and prevents unauthorized access.

---

## 4. Data Flow
1. The user logs in via the frontend; a Schnorr challenge is initiated.  
2. Upon successful verification, a JWT is generated.  
3. The user uploads SONAR images through the interface.  
4. Images undergo preprocessing and are sent to the ML API for inference.  
5. The model returns class predictions, confidence scores, and explanation maps (Grad-CAM++ and LIME).  
6. The backend stores the results in MongoDB.  
7. The user can view current and past predictions in the History dashboard.

---

## 5. Technologies Used

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React.js, Tailwind CSS, Vite |
| **Backend** | Node.js, Express.js, JWT, Schnorr Signature |
| **Database** | MongoDB Atlas |
| **Machine Learning** | DenseNet121, Grad-CAM++, LIME |
| **Explainability** | LIME, Grad-CAM++ |
| **Deployment** | Localhost / Render / AWS (configurable) |

---

## 6. Implementation Steps

### 6.1 Backend Setup
```bash
cd backend
npm install
npm start
```

### 6.2 Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 6.3 Environment Variables
Create a `.env` file in the backend directory and configure:
```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
ML_API_URL=http://localhost:8000/infer
```

---

## 7. Future Work
- Incorporate object detection for multi-class SONAR recognition.
- Develop real-time classification support via WebSocket.
- Implement role-based access (admin, researcher).
- Expand dataset and retrain DenseNet with fine-tuning for higher accuracy.
- Integrate advanced explainability methods like SHAP or integrated gradients.

---

## 8. Conclusion
This project successfully demonstrates a robust and interpretable AI-driven SONAR image classification system. The integration of deep learning, explainability, and secure authentication provides both performance and transparency, making the system suitable for research, naval, and underwater robotics applications.

---
