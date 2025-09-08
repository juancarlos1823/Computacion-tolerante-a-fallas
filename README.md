# 🏎️ Car Racing Game con Hilos y funciones asincronas

Un videojuego de carreras desarrollado con **Next.js** y **TypeScript** que implementa un sistema avanzado de checkpoints con persistencia de datos y técnicas de programación concurrente.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/juancarlos1823s-projects/v0-car-game-checkpointing)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/mR1aR7pfn21)

## 🎮 Características Principales

### Sistema de Checkpoints Avanzado
- **6 checkpoints** distribuidos estratégicamente en la pista
- **Efectos visuales dinámicos** con animaciones pulsantes y brillos
- **Barra de progreso** visual en tiempo real
- **Detección de colisiones** precisa usando algoritmo AABB
<img width="1014" height="848" alt="image" src="https://github.com/user-attachments/assets/591139d7-e278-47d6-957f-320b84a5b5fd" />
<img width="964" height="849" alt="image" src="https://github.com/user-attachments/assets/4dade06f-ecaf-4232-8d6e-00bfdf18212d" />
<img width="975" height="947" alt="image" src="https://github.com/user-attachments/assets/a2e9bb1f-0a3f-4367-8fa2-c9dd4d05891b" />
<img width="1024" height="942" alt="image" src="https://github.com/user-attachments/assets/a0073577-5c2c-4b7e-ad22-60958db9a8c9" />

<img width="969" height="845" alt="image" src="https://github.com/user-attachments/assets/8cd8c036-30e2-4beb-9258-38f4fef76723" />

### Persistencia de Datos
- **Guardado automático** cada 5 segundos y al pasar checkpoints
- **Recuperación de partidas** después de cerrar el navegador
- **Sistema de récords** personales con mejor tiempo
- **Almacenamiento local** usando localStorage

### Técnicas de Programación Avanzadas
- **Web Workers (Hilos)**: Procesamiento de física en paralelo
- **Service Workers (Demonios)**: Cache offline y sincronización en segundo plano
- **Programación Asíncrona**: Operaciones no bloqueantes con async/await
- **Procesamiento Paralelo**: Múltiples workers para diferentes tareas

## 🚀 Instalación y Ejecución

### Opción 1: Instalación Local
\`\`\`bash
# Clonar el repositorio
git clone https://github.com/juancarlos1823/car-game-checkpointing.git
cd car-game-checkpointing

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
\`\`\`

### Opción 2: Comando shadcn CLI (Recomendado)
\`\`\`bash
npx create-next-app@latest mi-juego-carros --example [ruta-del-ejemplo]
cd mi-juego-carros
npm install
npm run dev
\`\`\`

El juego estará disponible en `http://localhost:3000`

## 🎯 Controles del Juego

| Tecla | Acción |
|-------|--------|
| `W` o `↑` | Acelerar |
| `S` o `↓` | Frenar/Reversa |
| `A` o `←` | Girar izquierda |
| `D` o `→` | Girar derecha |
| `P` | Pausar/Reanudar |
| `R` | Reiniciar carrera |

## 🏁 Cómo Jugar

1. **Objetivo**: Completar todos los checkpoints en orden secuencial
2. **Progreso**: Los checkpoints completados se marcan en verde
3. **Checkpoint Actual**: Se muestra en amarillo pulsante
4. **Guardado**: El progreso se guarda automáticamente
5. **Recuperación**: Al reabrir el juego, puedes continuar desde donde te quedaste

## 🛠️ Tecnologías Utilizadas

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Canvas**: HTML5 Canvas API para renderizado 2D
- **Persistencia**: localStorage API
- **Concurrencia**: Web Workers, Service Workers
- **Deployment**: Vercel

## 🧵 Implementación de Técnicas Avanzadas

### Web Workers (Hilos)
\`\`\`typescript
// Physics Worker - Procesamiento de física en hilo separado
const physicsWorker = new Worker(physicsWorkerBlob)
physicsWorker.postMessage({ type: 'UPDATE_CAR', car, keys })
\`\`\`
<img width="601" height="408" alt="image" src="https://github.com/user-attachments/assets/4c9084ea-e472-43c9-bd86-11584d2bfc3c" />
<img width="591" height="312" alt="image" src="https://github.com/user-attachments/assets/7ccb71a9-79b1-4f7a-acbe-0505f7027f9e" />

### Service Workers (Demonios)
\`\`\`typescript
// Registro de Service Worker para cache offline
navigator.serviceWorker.register('/sw.js')
registration.sync.register('background-save')
\`\`\`
<img width="593" height="332" alt="image" src="https://github.com/user-attachments/assets/a65927ef-0dfe-4258-9709-674cc8b10173" />

### Programación Asíncrona
\`\`\`typescript
// Guardado asíncrono no bloqueante
const saveGameAsync = async (state) => {
  await new Promise(resolve => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    resolve()
  })
}
\`\`\`
<img width="590" height="434" alt="image" src="https://github.com/user-attachments/assets/fe401aff-fc37-46d8-920e-5095a9580aea" />

## 📊 Arquitectura del Sistema

\`\`\`
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Main Thread   │◄──►│  Physics Worker  │    │ Effects Worker  │
│   (UI/Render)   │    │   (Cálculos)     │    │  (Partículas)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Service Worker │    │   localStorage   │    │  Canvas API     │
│  (Cache/Sync)   │    │  (Persistencia)  │    │  (Renderizado)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
\`\`\`

## 🎨 Características Visuales

- **Efectos de partículas** para el escape del carro
- **Animaciones suaves** con interpolación
- **Sistema de colores** dinámico para checkpoints
- **Interfaz responsiva** adaptable a diferentes pantallas
- **Efectos de brillo** al completar checkpoints

## 🔧 Desarrollo

### Estructura del Proyecto
\`\`\`
├── app/
│   ├── page.tsx              # Página principal
│   ├── layout.tsx            # Layout base
│   └── globals.css           # Estilos globales
├── components/
│   ├── car-racing-game.tsx   # Componente principal del juego
│   └── ui/                   # Componentes de UI
└── public/
    └── sw.js                 # Service Worker (generado)
\`\`\`

### Scripts Disponibles
\`\`\`bash
npm run dev      # Desarrollo
npm run build    # Construcción para producción
npm run start    # Servidor de producción
npm run lint     # Linting del código
\`\`\`

## 🚀 Deployment

El proyecto está configurado para deployment automático en Vercel:

**[https://vercel.com/juancarlos1823s-projects/v0-car-game-checkpointing](https://vercel.com/juancarlos1823s-projects/v0-car-game-checkpointing)**

## 📝 Licencia

Este proyecto fue desarrollado como parte de un ejercicio académico de **Computación Tolerante a Fallas**.

## 👥 Contribuidores

- **Juan Carlos Esparza Hernández** - [@juancarlos1823](https://github.com/juancarlos1823)

---

*Desarrollado con ❤️ usando [v0.app](https://v0.app)*
