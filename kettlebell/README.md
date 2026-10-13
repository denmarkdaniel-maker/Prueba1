# Girya Coach

App de entrenamiento con kettlebell para el celular:

- 50 ejercicios precargados, cada uno con su animación 3D (se puede girar arrastrando con el dedo).
- Registro de series, repeticiones y peso. Los pesos siguen el código de colores de competición: 8 rosado, 12 azul, 16 amarillo, 20 morado, 24 verde, 28 naranjo, 32 rojo, etc.
- Contador de series con descanso: al terminar el descanso suena un aviso y el teléfono vibra.
- Historial por día, gráfico de volumen semanal y exportación a CSV (separador `;`, se abre directo en Excel o Power BI).
- **Coach Claude**: chat conectado a Claude. Conoce el catálogo y tu historial, arma rutinas como tarjetas que se pueden tocar y registra entrenamientos que le cuentas en lenguaje natural.

## Dos formas de usarla

### 1. Dentro de Claude (recomendado: conexión directa)
La app se publica como Artifact en claude.ai y se abre desde la app de Claude en el celular.
Ahí el coach usa Claude con tu propia cuenta y el historial se guarda en la base de datos del artifact. Así lo ves desde cualquier dispositivo y Claude puede leerlo en otras conversaciones.

Para regenerar el archivo que se publica:

```bash
python3 build_artifact.py            # crea dist/girya-artifact.html
```

### 2. Instalada como app (PWA, ícono en la pantalla de inicio)
La carpeta `kettlebell/` es un sitio estático que se instala y funciona sin conexión.

1. En GitHub ve a **Settings → Pages**, elige "Deploy from a branch", selecciona la rama y la carpeta raíz `/`, y guarda.
2. Abre `https://<usuario>.github.io/<repo>/kettlebell/` en el celular.
3. En Android (Chrome): menú ⋮ → **Instalar app**. En iPhone (Safari): Compartir → **Agregar a inicio**.

Fuera de Claude, el coach abre la app de Claude con tu resumen de entrenamiento y tu pregunta ya escritos (`claude.ai/new?q=…`). También puedes copiar ese resumen.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de la app |
| `css/app.css` | Diseño (tema oscuro y claro) |
| `js/exercises.js` | Los 50 ejercicios: técnica, errores comunes, dosis sugerida, animación |
| `js/kb3d.js` | Motor 3D (Three.js r128): maniquí articulado, kettlebell y 32 animaciones |
| `js/app.js` | Navegación, registro, historial, contador de series y conexión con Claude |
| `ANIMS.md` | Contrato de animaciones entre la base de ejercicios y el motor 3D |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación y uso sin conexión |
| `build_artifact.py` | Empaqueta todo en un solo HTML para publicarlo en Claude |
