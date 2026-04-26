import io
import os
import cv2
import base64
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf
from tensorflow.keras.preprocessing.image import img_to_array

from explainer import generate_lime_mask

# --------------------------------------------------
# CONFIG
# --------------------------------------------------

BASE_DIR = os.path.dirname(__file__)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "DenseNet121_final_model"
)

CLASS_NAMES = [
    "fish",
    "human",
    "mine",
    "plane",
    "seafloor",
    "ship"
]

IMAGE_SIZE = (224, 224)

# --------------------------------------------------
# LOAD MODEL (ONCE)
# --------------------------------------------------

print("Loading model...")
model = tf.keras.models.load_model(MODEL_PATH, compile=False)
print("Model loaded successfully.")

# --------------------------------------------------
# FASTAPI APP
# --------------------------------------------------

app = FastAPI(title="Sonar Image Classification API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize(IMAGE_SIZE)
    arr = img_to_array(image) / 255.0
    arr = np.expand_dims(arr, axis=0)
    return arr

def generate_gradcam_simple(img_array, model, class_idx):
    """Generate Grad-CAM heatmap - simplified version"""
    try:
        # Get model layers
        layer_names = [layer.name for layer in model.layers]
        
        # Find last conv layer (DenseNet usually ends with 'conv5_block')
        last_conv_layer_name = None
        for name in reversed(layer_names):
            if 'conv' in name.lower() and 'block' in name.lower():
                last_conv_layer_name = name
                break
        
        # Fallback to any conv layer
        if not last_conv_layer_name:
            for name in reversed(layer_names):
                if 'conv' in name.lower():
                    last_conv_layer_name = name
                    break
        
        if not last_conv_layer_name:
            print("No conv layer found, using dummy heatmap")
            return create_dummy_heatmap()
        
        print(f"Using layer: {last_conv_layer_name}")
        
        # Create gradient model
        grad_model = tf.keras.models.Model(
            inputs=[model.input],
            outputs=[model.get_layer(last_conv_layer_name).output, model.output]
        )
        
        # Compute gradient
        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(img_array)
            loss = predictions[:, class_idx]
        
        # Get gradients
        grads = tape.gradient(loss, conv_outputs)
        
        if grads is None:
            print("Gradients are None, using dummy heatmap")
            return create_dummy_heatmap()
        
        # Pool gradients
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        
        # Weight channels
        conv_outputs = conv_outputs[0].numpy()
        pooled_grads = pooled_grads.numpy()
        
        for i in range(len(pooled_grads)):
            conv_outputs[:, :, i] *= pooled_grads[i]
        
        # Create heatmap
        heatmap = np.mean(conv_outputs, axis=-1)
        heatmap = np.maximum(heatmap, 0)
        
        if np.max(heatmap) > 0:
            heatmap /= np.max(heatmap)
        
        # Resize to 224x224
        heatmap = cv2.resize(heatmap, (224, 224))
        heatmap = np.uint8(255 * heatmap)
        
        return heatmap
        
    except Exception as e:
        print(f"Grad-CAM error: {e}")
        return create_dummy_heatmap()

def create_dummy_heatmap():
    """Create a simple center-weighted heatmap as fallback"""
    heatmap = np.zeros((224, 224), dtype=np.float32)
    center = (112, 112)
    for i in range(224):
        for j in range(224):
            dist = np.sqrt((i - center[0])**2 + (j - center[1])**2)
            heatmap[i, j] = max(0, 1 - dist / 112)
    return np.uint8(255 * heatmap)

# --------------------------------------------------
# ROUTES
# --------------------------------------------------

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()

        img_array = preprocess_image(image_bytes)

        preds = model.predict(img_array)
        idx = int(np.argmax(preds[0]))

        label = CLASS_NAMES[idx]
        probability = float(preds[0][idx])

        # Get original image for overlay
        orig = (img_array[0] * 255).astype(np.uint8)

        # -------- GRAD-CAM EXPLANATION --------
        print("Generating Grad-CAM...")
        gradcam_heatmap = generate_gradcam_simple(img_array, model, idx)
        
        # Apply colormap
        gradcam_colored = cv2.applyColorMap(gradcam_heatmap, cv2.COLORMAP_JET)
        
        # Overlay on original
        gradcam_overlay = cv2.addWeighted(orig, 0.6, gradcam_colored, 0.4, 0)
        
        # Convert to base64
        buffer_gradcam = io.BytesIO()
        Image.fromarray(gradcam_overlay).save(buffer_gradcam, format="PNG")
        buffer_gradcam.seek(0)
        gradcam_base64 = base64.b64encode(buffer_gradcam.getvalue()).decode("utf-8")

        # -------- LIME EXPLANATION --------
        print("Generating LIME...")
        lime_img, _ = generate_lime_mask(
            img_array[0],
            model,
            num_samples=100,
            num_features=10
        )

        # Normalize LIME mask
        lime_norm = cv2.normalize(
            lime_img, None, 0, 255, cv2.NORM_MINMAX
        ).astype(np.uint8)

        # Directly overlay grayscale LIME mask on original (no color applied)
        lime_overlay = cv2.addWeighted(orig, 0.6, lime_norm, 0.4, 0)

        # Convert to base64
        buffer_lime = io.BytesIO()
        Image.fromarray(lime_overlay).save(buffer_lime, format="PNG")
        buffer_lime.seek(0)
        lime_base64 = base64.b64encode(buffer_lime.getvalue()).decode("utf-8")


        print("Success!")
        
        return {
            "label": label,
            "probability": probability,
            "gradcam_image_base64": gradcam_base64,
            "lime_image_base64": lime_base64
        }
        
    except Exception as e:
        print(f"ERROR in /predict: {str(e)}")
        import traceback
        traceback.print_exc()
        raise