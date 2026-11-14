import time
from pathlib import Path
import urllib.request
import cv2
import numpy as np
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# 1. Descarga automática del modelo si no existe
MODEL_PATH = Path(__file__).resolve().parent / "hand_landmarker.task"
if not MODEL_PATH.exists():
    print("Descargando modelo hand_landmarker.task...")
    url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    urllib.request.urlretrieve(url, MODEL_PATH)

# 2. Configuración de proporciones y amplificación de movimiento
LIENZO_ANCHO, LIENZO_ALTO = 2400, 1800   # Rectángulo grande (futura imagen)
VENTANA_ANCHO, VENTANA_ALTO = 400, 300   # Ventana móvil mucho más pequeña (1/6 del tamaño)

SENSIBILIDAD = 2.4   # Amplifica el movimiento (2.4x = recorres todo el lienzo sin mover mucho la mano)
SUAVIZADO = 0.22     # Suaviza el movimiento para compensar la mayor sensibilidad

def crear_rectangulo_gris(ancho, alto):
    """Genera el rectángulo gris con cuadrícula de referencia."""
    lienzo = np.full((alto, ancho, 3), (110, 110, 110), dtype=np.uint8)
    paso = 150
    for x in range(0, ancho, paso):
        cv2.line(lienzo, (x, 0), (x, alto), (140, 140, 140), 1)
    for y in range(0, alto, paso):
        cv2.line(lienzo, (0, y), (ancho, y), (140, 140, 140), 1)
        for x in range(0, ancho, paso):
            cv2.putText(lienzo, f"{x},{y}", (x + 10, y + 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (185, 185, 185), 1)
    return lienzo

# EN EL FUTURO: Reemplaza la siguiente línea por -> lienzo = cv2.imread("tu_imagen.jpg")
lienzo = cv2.imread("rio parana.jpeg")
if lienzo is None:
    raise FileNotFoundError("No se pudo cargar la imagen. Verifica la ruta.")

alto, ancho = lienzo.shape[:2]

# Si la imagen es menor o igual que la ventana, se agranda proporcionalmente
# El factor 1.5 garantiza espacio extra para poder desplazarte sobre ella
if ancho <= VENTANA_ANCHO or alto <= VENTANA_ALTO:
    escala = max(VENTANA_ANCHO / ancho, VENTANA_ALTO / alto) * 1.5
    nuevo_ancho = int(ancho * escala)
    nuevo_alto = int(alto * escala)
    lienzo = cv2.resize(lienzo, (nuevo_ancho, nuevo_alto), interpolation=cv2.INTER_LINEAR)

lienzo_alto, lienzo_ancho = lienzo.shape[:2]

# Posición inicial centrada
pos_x, pos_y = 0.5, 0.5

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (0, 17), (17, 18), (18, 19), (19, 20)
]

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
    running_mode=VisionRunningMode.VIDEO,
    num_hands=2,
    min_hand_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)
last_timestamp_ms = -1

try:
    with HandLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)
            cam_alto, cam_ancho, _ = frame.shape

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            timestamp_ms = int(time.perf_counter() * 1000)
            if timestamp_ms <= last_timestamp_ms:
                timestamp_ms = last_timestamp_ms + 1
            last_timestamp_ms = timestamp_ms

            result = landmarker.detect_for_video(mp_image, timestamp_ms)

            # Dibujar en la webcam la "zona activa" donde debes mover tu mano
            margen_norm = 0.5 - (0.5 / SENSIBILIDAD)
            zx1 = int(margen_norm * cam_ancho)
            zy1 = int(margen_norm * cam_alto)
            zx2 = int((1.0 - margen_norm) * cam_ancho)
            zy2 = int((1.0 - margen_norm) * cam_alto)
            cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), (255, 200, 0), 1)
            cv2.putText(frame, "Zona de control", (zx1 + 5, zy1 - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 200, 0), 1)

            # 3. Buscar mano derecha y amplificar su desplazamiento
            if result.hand_landmarks and result.handedness:
                for idx, hand_landmarks in enumerate(result.hand_landmarks):
                    etiqueta_raw = result.handedness[idx][0].category_name
                    es_mano_derecha = (etiqueta_raw == "Left")

                    puntos = [(int(lm.x * cam_ancho), int(lm.y * cam_alto)) for lm in hand_landmarks]
                    color_esqueleto = (0, 255, 0) if es_mano_derecha else (150, 150, 150)

                    for inicio, fin in HAND_CONNECTIONS:
                        cv2.line(frame, puntos[inicio], puntos[fin], color_esqueleto, 2)

                    if es_mano_derecha:
                        centro_mano = hand_landmarks[9]

                        # Amplificar coordenadas respecto al centro (0.5, 0.5) y limitar a [0, 1]
                        objetivo_x = float(np.clip((centro_mano.x - 0.5) * SENSIBILIDAD + 0.5, 0.0, 1.0))
                        objetivo_y = float(np.clip((centro_mano.y - 0.5) * SENSIBILIDAD + 0.5, 0.0, 1.0))

                        # Suavizado exponencial
                        pos_x += (objetivo_x - pos_x) * SUAVIZADO
                        pos_y += (objetivo_y - pos_y) * SUAVIZADO

                        cv2.circle(frame, puntos[9], 9, (0, 0, 255), -1)

            # 4. Calcular recorte de la ventana pequeña sobre el rectángulo grande
            cx = int(pos_x * lienzo_ancho)
            cy = int(pos_y * lienzo_alto)

            x1 = max(0, min(lienzo_ancho - VENTANA_ANCHO, cx - VENTANA_ANCHO // 2))
            y1 = max(0, min(lienzo_alto - VENTANA_ALTO, cy - VENTANA_ALTO // 2))
            x2 = x1 + VENTANA_ANCHO
            y2 = y1 + VENTANA_ALTO

            vista_ventana = lienzo[y1:y2, x1:x2].copy()

            # Mira central
            cv2.drawMarker(vista_ventana, (VENTANA_ANCHO // 2, VENTANA_ALTO // 2),
                           (0, 0, 255), cv2.MARKER_CROSS, 16, 2)

            # 5. Minimapa en la esquina superior izquierda de la webcam
            mini_w, mini_h = 180, 135
            minimapa = cv2.resize(lienzo, (mini_w, mini_h))
            mx1 = int((x1 / lienzo_ancho) * mini_w)
            my1 = int((y1 / lienzo_alto) * mini_h)
            mx2 = int((x2 / lienzo_ancho) * mini_w)
            my2 = int((y2 / lienzo_alto) * mini_h)
            cv2.rectangle(minimapa, (mx1, my1), (mx2, my2), (0, 0, 255), 2)
            frame[10:10 + mini_h, 10:10 + mini_w] = minimapa

            cv2.imshow("Webcam (Control Amplificado)", frame)
            cv2.imshow("Ventana Pequena", vista_ventana)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == 27:
                break
finally:
    cap.release()
    cv2.destroyAllWindows()