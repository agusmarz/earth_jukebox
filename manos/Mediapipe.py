import copy
from dataclasses import dataclass, field
import math
from pathlib import Path
import threading
import time
import urllib.request
import cv2
import mediapipe as mp
import numpy as np

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode


# =====================================================================
# 1. CONTRATO DE DATOS (Estado compartido entre Visión, Imagen y Música)
# =====================================================================
@dataclass
class EstadoGestos:
    # Mano derecha (espacio y configuraciones)
    mano_derecha_activa: bool = False
    pos_x: float = 0.5                  # Normalizado [0.0, 1.0]
    pos_y: float = 0.5                  # Normalizado [0.0, 1.0]
    dedos_levantados: list[bool] = field(default_factory=lambda: [False] * 5)

    # Mano izquierda (control temporal relativo al movimiento)
    mano_izquierda_activa: bool = False
    angulo_tiempo: float = 0.0          # Grados acumulados (puede superar +-360°)
    velocidad_angular: float = 0.0      # Grados/frame (útil para modular velocidad/pitch en audio)
    girando_activamente: bool = False   # True mientras describe un movimiento circular


# =====================================================================
# 2. PRODUCTOR DE VISIÓN (Lógica pura de MediaPipe y matemáticas)
# =====================================================================
class RastreadorManos:
    HAND_CONNECTIONS = [
        (0, 1), (1, 2), (2, 3), (3, 4),
        (0, 5), (5, 6), (6, 7), (7, 8),
        (5, 9), (9, 10), (10, 11), (11, 12),
        (9, 13), (13, 14), (14, 15), (15, 16),
        (13, 17), (0, 17), (17, 18), (18, 19), (19, 20),
    ]

    def __init__(self, sensibilidad: float = 2.4, suavizado: float = 0.22):
        self.sensibilidad = sensibilidad
        self.suavizado = suavizado

        # Parámetros del centro dinámico flotante (mano izquierda)
        self.suavizado_mano_izq = 0.35      # Filtra micro-temblores de la mano
        self.seguimiento_centro = 0.065     # Qué tan rápido el eje sigue la deriva del movimiento
        self.radio_minimo = 0.035           # Umbral de movimiento para considerar que está girando

        self._pos_suave_izq: tuple[float, float] | None = None
        self._centro_dinamico_izq: tuple[float, float] | None = None
        self._ultimo_angulo_izq: float | None = None

        self._estado = EstadoGestos()
        self._lock = threading.Lock()
        self._last_timestamp_ms = -1

        model_path = self._asegurar_modelo()
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=VisionRunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.landmarker = HandLandmarker.create_from_options(options)

    def _asegurar_modelo(self) -> Path:
        model_path = Path(__file__).resolve().parent / "hand_landmarker.task"
        if not model_path.exists():
            print("Descargando modelo hand_landmarker.task...")
            url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
            urllib.request.urlretrieve(url, model_path)
        return model_path

    @staticmethod
    def _detectar_dedos(hand_landmarks) -> list[bool]:
        pulgar = (hand_landmarks[4].x - hand_landmarks[3].x) * (
            hand_landmarks[5].x - hand_landmarks[17].x
        ) > 0
        dedos = [bool(pulgar)]
        for punta, art in zip([8, 12, 16, 20], [6, 10, 14, 18]):
            dedos.append(bool(hand_landmarks[punta].y < hand_landmarks[art].y))
        return dedos

    def procesar_frame(self, frame_bgr: np.ndarray) -> np.ndarray:
        """Procesa un frame en modo espejo, actualiza el estado y dibuja guías."""
        cam_alto, cam_ancho, _ = frame_bgr.shape
        rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        timestamp_ms = int(time.perf_counter() * 1000)
        if timestamp_ms <= self._last_timestamp_ms:
            timestamp_ms = self._last_timestamp_ms + 1
        self._last_timestamp_ms = timestamp_ms

        result = self.landmarker.detect_for_video(mp_image, timestamp_ms)

        derecha_vista = False
        izquierda_vista = False

        with self._lock:
            if result.hand_landmarks and result.handedness:
                for idx, hand_landmarks in enumerate(result.hand_landmarks):
                    etiqueta_raw = result.handedness[idx][0].category_name
                    es_derecha = etiqueta_raw == "Left"
                    puntos = [
                        (int(lm.x * cam_ancho), int(lm.y * cam_alto))
                        for lm in hand_landmarks
                    ]

                    color_esqueleto = (0, 255, 0) if es_derecha else (255, 180, 0)
                    for inicio, fin in self.HAND_CONNECTIONS:
                        cv2.line(frame_bgr, puntos[inicio], puntos[fin], color_esqueleto, 2)

                    if es_derecha:
                        derecha_vista = True
                        self._actualizar_mano_derecha(hand_landmarks, puntos, frame_bgr)
                    else:
                        izquierda_vista = True
                        self._actualizar_mano_izquierda(
                            hand_landmarks, puntos, cam_ancho, cam_alto, frame_bgr
                        )

            self._estado.mano_derecha_activa = derecha_vista
            if not derecha_vista:
                self._estado.dedos_levantados = [False] * 5

            self._estado.mano_izquierda_activa = izquierda_vista
            if not izquierda_vista:
                # Reiniciar estado dinámico para evitar saltos cuando vuelva a entrar la mano
                self._estado.girando_activamente = False
                self._estado.velocidad_angular = 0.0
                self._pos_suave_izq = None
                self._centro_dinamico_izq = None
                self._ultimo_angulo_izq = None

            estado_snapshot = copy.deepcopy(self._estado)

        self._dibujar_hud(frame_bgr, estado_snapshot)
        return frame_bgr

    def _actualizar_mano_derecha(self, landmarks, puntos, frame):
        self._estado.dedos_levantados = self._detectar_dedos(landmarks)
        centro = landmarks[9]

        obj_x = float(np.clip((centro.x - 0.5) * self.sensibilidad + 0.5, 0.0, 1.0))
        obj_y = float(np.clip((centro.y - 0.5) * self.sensibilidad + 0.5, 0.0, 1.0))

        self._estado.pos_x += (obj_x - self._estado.pos_x) * self.suavizado
        self._estado.pos_y += (obj_y - self._estado.pos_y) * self.suavizado

        cv2.circle(frame, puntos[9], 9, (0, 0, 255), -1)

    def _actualizar_mano_izquierda(self, landmarks, puntos, ancho, alto, frame):
        raw_x, raw_y = landmarks[9].x, landmarks[9].y

        # Inicializar referencias en el punto exacto donde aparece la mano
        if self._pos_suave_izq is None or self._centro_dinamico_izq is None:
            self._pos_suave_izq = (raw_x, raw_y)
            self._centro_dinamico_izq = (raw_x, raw_y)
            self._ultimo_angulo_izq = None
            return

        # 1. Suavizar posición actual de la mano
        sx = self._pos_suave_izq[0] + (raw_x - self._pos_suave_izq[0]) * self.suavizado_mano_izq
        sy = self._pos_suave_izq[1] + (raw_y - self._pos_suave_izq[1]) * self.suavizado_mano_izq
        self._pos_suave_izq = (sx, sy)

        cx, cy = self._centro_dinamico_izq

        # 2. Vector desde el centro dinámico hacia la mano (compensando relación de aspecto)
        dx = sx - cx
        dy = (sy - cy) * (alto / ancho)
        radio_actual = math.hypot(dx, dy)

        if radio_actual > self.radio_minimo:
            self._estado.girando_activamente = True
            angulo_actual = math.degrees(math.atan2(dy, dx))

            if self._ultimo_angulo_izq is not None:
                delta = angulo_actual - self._ultimo_angulo_izq
                if delta > 180:
                    delta -= 360
                elif delta < -180:
                    delta += 360

                self._estado.angulo_tiempo += delta
                self._estado.velocidad_angular = delta
            else:
                self._estado.velocidad_angular = 0.0

            self._ultimo_angulo_izq = angulo_actual
        else:
            # La mano está quieta o el centro dinámico ya la alcanzó
            self._estado.girando_activamente = False
            self._estado.velocidad_angular = 0.0
            self._ultimo_angulo_izq = None

        # 3. Actualizar centro dinámico para que siga la deriva de la mano en el aire
        cx += (sx - cx) * self.seguimiento_centro
        cy += (sy - cy) * self.seguimiento_centro
        self._centro_dinamico_izq = (cx, cy)

        # Visualización de depuración para ver el eje flotante siguiendo la mano
        cx_px, cy_px = int(cx * ancho), int(cy * alto)
        sx_px, sy_px = int(sx * ancho), int(sy * alto)
        color_eje = (0, 255, 255) if self._estado.girando_activamente else (140, 140, 140)

        cv2.circle(frame, (cx_px, cy_px), 6, color_eje, -1)
        cv2.circle(frame, (cx_px, cy_px), int(self.radio_minimo * ancho), color_eje, 1)
        cv2.line(frame, (cx_px, cy_px), (sx_px, sy_px), color_eje, 2)

    def _dibujar_hud(self, frame: np.ndarray, estado: EstadoGestos):
        h, w, _ = frame.shape

        # Zona de control mano derecha
        margen = 0.5 - (0.5 / self.sensibilidad)
        cv2.rectangle(
            frame,
            (int(margen * w), int(margen * h)),
            (int((1 - margen) * w), int((1 - margen) * h)),
            (255, 200, 0),
            1,
        )

        # Textos informativos
        vueltas = estado.angulo_tiempo / 360.0
        cv2.putText(
            frame,
            f"Tiempo (Izq): {estado.angulo_tiempo:.1f} deg ({vueltas:.2f} vueltas)",
            (10, h - 42),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 255, 255),
            2,
        )
        cv2.putText(
            frame,
            f"Dedos (Der): {[int(d) for d in estado.dedos_levantados]}",
            (10, h - 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 255, 0),
            2,
        )

    def obtener_estado(self) -> EstadoGestos:
        """Devuelve una copia segura para otros hilos (música, red, etc.)."""
        with self._lock:
            return copy.deepcopy(self._estado)

    def cerrar(self):
        self.landmarker.close()


# =====================================================================
# 3. CONSUMIDOR DE IMAGEN (Ventana móvil sobre el lienzo)
# =====================================================================
class VisorImagen:
    def __init__(self, ruta_imagen: str, ventana_w: int = 400, ventana_h: int = 300):
        self.ventana_w = ventana_w
        self.ventana_h = ventana_h

        lienzo = cv2.imread(ruta_imagen)
        if lienzo is None:
            raise FileNotFoundError(f"No se pudo cargar la imagen: {ruta_imagen}")

        alto, ancho = lienzo.shape[:2]
        if ancho <= ventana_w or alto <= ventana_h:
            escala = max(ventana_w / ancho, ventana_h / alto) * 1.5
            lienzo = cv2.resize(
                lienzo,
                (int(ancho * escala), int(alto * escala)),
                interpolation=cv2.INTER_LINEAR,
            )

        self.lienzo = lienzo
        self.lienzo_h, self.lienzo_w = lienzo.shape[:2]

    def renderizar(self, frame_webcam: np.ndarray, estado: EstadoGestos) -> np.ndarray:
        cx = int(estado.pos_x * self.lienzo_w)
        cy = int(estado.pos_y * self.lienzo_h)

        x1 = max(0, min(self.lienzo_w - self.ventana_w, cx - self.ventana_w // 2))
        y1 = max(0, min(self.lienzo_h - self.ventana_h, cy - self.ventana_h // 2))
        x2, y2 = x1 + self.ventana_w, y1 + self.ventana_h

        vista = self.lienzo[y1:y2, x1:x2].copy()
        cv2.drawMarker(
            vista,
            (self.ventana_w // 2, self.ventana_h // 2),
            (0, 0, 255),
            cv2.MARKER_CROSS,
            16,
            2,
        )

        # Minimapa en webcam
        mini_w, mini_h = 180, 135
        minimapa = cv2.resize(self.lienzo, (mini_w, mini_h))
        mx1, my1 = int((x1 / self.lienzo_w) * mini_w), int((y1 / self.lienzo_h) * mini_h)
        mx2, my2 = int((x2 / self.lienzo_w) * mini_w), int((y2 / self.lienzo_h) * mini_h)
        cv2.rectangle(minimapa, (mx1, my1), (mx2, my2), (0, 0, 255), 2)
        frame_webcam[10 : 10 + mini_h, 10 : 10 + mini_w] = minimapa

        return vista


# =====================================================================
# 4. CONSUMIDOR DE MÚSICA (Ejemplo corriendo en hilo paralelo)
# =====================================================================
def bucle_motor_musica(rastreador: RastreadorManos, evento_parada: threading.Event):
    while not evento_parada.is_set():
        estado = rastreador.obtener_estado()

        # Variables disponibles:
        # - estado.pos_x, estado.pos_y     -> Posición en el plano [0.0, 1.0]
        # - estado.dedos_levantados      -> Lista de 5 bools [Pulgar..Meñique]
        # - estado.angulo_tiempo         -> Grados totales acumulados
        # - estado.velocidad_angular     -> Velocidad y sentido del giro actual (+/-)

        time.sleep(0.02)


# =====================================================================
# 5. ORQUESTADOR PRINCIPAL
# =====================================================================
def main():
    rastreador = RastreadorManos(sensibilidad=2.4, suavizado=0.22)
    visor = VisorImagen("manos/rio parana.jpeg", ventana_w=400, ventana_h=300)

    evento_parada = threading.Event()
    hilo_musica = threading.Thread(
        target=bucle_motor_musica,
        args=(rastreador, evento_parada),
        daemon=True,
    )
    hilo_musica.start()

    cap = cv2.VideoCapture(0)
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)
            frame = rastreador.procesar_frame(frame)
            estado_actual = rastreador.obtener_estado()

            vista_ventana = visor.renderizar(frame, estado_actual)

            cv2.imshow("Webcam (Control Accesible)", frame)
            cv2.imshow("Ventana Pequena", vista_ventana)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == 27:
                break
    finally:
        evento_parada.set()
        hilo_musica.join(timeout=1.0)
        cap.release()
        rastreador.cerrar()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()