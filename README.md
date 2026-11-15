# Earth Jukebox · The Melody of Water

Our entry for The Earth Information Jukebox challenge of the NASA Space Apps Challenge 2026. The Melody of Water is a web app for listening to rivers, designed for blind and low-vision people. It uses measurements from the SWOT satellite (NASA and CNES): each feature of the river is played by a family of instruments in an orchestra. You explore the river by moving your hand in front of the camera, change the season by turning your fist, and control everything with your voice.

There are ten rivers, roughly the ones with the largest mean discharge in the world, not counting tributaries: Amazon, Congo, Ganges, Orinoco, Yangtze, Yenisei, Paraná, Lena, Mississippi and Mekong. The selection criteria and their caveats are in [Qué ríos hay y por qué](app/README.md#qué-ríos-hay-y-por-qué) (in Spanish).

## Live demo

https://agusmarz.github.io/earth_jukebox/ (Chrome or Edge, best with headphones). It asks for camera and microphone permission, and needs an internet connection for hand tracking and speech recognition.

### Gestures

- **Right hand.** Moves a square over the map. On the river it sounds loud, and as it moves away the volume drops, the highs fade and more reverb is added. Stereo panning tells you which side the river is on.
- **Right-hand fingers.** The thumb, index, middle and ring fingers turn the four layers of the orchestra on and off. Finger up, layer on.
- **Left hand.** With the fist closed, each full turn moves to the next season (clockwise) or the previous one (counterclockwise). A voice note announces the new season.

Hands are tracked with MediaPipe in the browser. So that a closed fist doesn't get the left and right hands mixed up, the body model also runs, since it knows which arm each wrist belongs to.

### Voice and keyboard

Hold the space bar to speak. When you release it, the app does what you asked and confirms it out loud. It understands phrases in English and Spanish, for example "next", "winter", "width off", "global scale", "two octaves", "zoom in", "repeat", "status", "help" or "menu". If it isn't sure which river you meant, it asks ("Did you mean the Ganges? Say yes or no").

Without a camera, the mouse and arrow keys move the square. On the river dashboard, 1 to 4 turn the layers on and off, R replays the introduction, N switches the normalization, M the musical logic, + and − zoom, 0 goes back to the whole river and Escape returns to the menu.

## What you hear

Each feature of the river segment closest to the square drives a family of instruments. They all play at 80 bpm over the same chord progression in D minor, so the ensemble always sounds musical. The recordings come from VSCO 2 Community Edition.

| Finger | Feature | Instruments |
| --- | --- | --- |
| Thumb | River width | Cellos, violas and violins |
| Index | Water level above sea level | Bassoon, clarinet, oboe and flute |
| Middle | Slope | Harp and timpani |
| Ring | Range (how much the water rises and falls over the year) | Double bass and horns |

There are three musical logics (original, two octaves and relief) and two normalizations. The per-river one uses the full sound range for each river, and the global one uses fixed ranges so rivers can be compared with each other. Seasons replace the values of each segment with those measured only in those three months. Details are in [app/demo/README.md](app/demo/README.md#qué-suena) (in Spanish).

## How to run it

All it needs is Python as a local server, because the browser won't load the samples or use the camera from a file opened with a double click.

```bash
cd app/demo
python -m http.server 8000
```

Then open http://localhost:8000 in Chrome or Edge. The first click or key press enables audio. Firefox doesn't support speech recognition and will tell you to use the keyboard.

## Data

Water level, width and slope for each river segment come from PO.DAAC's [Hydrocron](https://podaac.github.io/hydrocron/) API, with the geometry and topology of SWORD v17b. Only the main channel is processed, without tributaries, and segments without good passes are interpolated along the channel. Any SWORD river can be added with a configuration file and one command.

```bash
cd app/scripts
python procesar_rio.py <id>
```

This downloads the data, generates the maps, the demo data and its seasons, and adds the river to the menu. The step-by-step guide, the cleaning criteria and the file formats are in [app/README.md](app/README.md), and what each column means is in [app/GLOSARIO.md](app/GLOSARIO.md) (both in Spanish).

## Structure

```
app/
  demo/               the web app, The Melody of Water (see its README)
  scripts/            data pipeline, orchestral samples, voice-overs and world map
  rios/               configuration of each river and global normalization scales
  datos/              SWOT data per river (raw Hydrocron responses, observations, metrics, geometry)
  mapas/              maps of each metric per river, as .html and .png
app_video/            first prototype, using the segments of the NASA video
preprocesamiento/     scripts that cut the video for app_video
manos/                Python prototype of the hand control (MediaPipe), the basis of manos.js
analisis/             notebook with river statistics
```

## Credits

SWOT mission data (NASA and CNES), SWOT Level 2 River Single-Pass Vector Data Product, version D, via PO.DAAC's Hydrocron. SWORD v17b reaches and topology (Altenau et al.). Visualization for the first prototype by NASA's Scientific Visualization Studio. Orchestral samples from VSCO 2 Community Edition (Versilian Studios, CC0). Hand and body tracking with MediaPipe (Google). Microsoft neural voices via edge-tts. World map from Natural Earth via world-atlas. Archivo typeface under the SIL Open Font License.
