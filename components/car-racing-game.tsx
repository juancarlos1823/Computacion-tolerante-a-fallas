"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

interface Recording {
  id: string
  name: string
  blob: Blob
  duration: number
  createdAt: number
  raceTime: number
  checkpointsCompleted: number
}

interface Car {
  x: number
  y: number
  angle: number
  speed: number
  maxSpeed: number
}

interface Checkpoint {
  x: number
  y: number
  width: number
  height: number
  id: number
  passed: boolean
  justPassed?: boolean
  passedTime?: number
}

interface GameState {
  car: Car
  checkpoints: Checkpoint[]
  currentCheckpoint: number
  gameStarted: boolean
  gamePaused: boolean
  raceTime: number
  totalCheckpoints: number
  raceCompleted: boolean
  bestTime?: number
  isRecording: boolean
  currentRecording?: Recording
}

interface SavedGame {
  car: Car
  checkpoints: Checkpoint[]
  currentCheckpoint: number
  raceTime: number
  savedAt: number
  bestTime?: number
}

interface GameStats {
  gamesCompleted: number
  bestTime: number | null
  totalPlayTime: number
  checkpointsPassed: number
}

const STORAGE_KEY = "car-racing-game-save"
const STATS_KEY = "car-racing-game-stats"
const RECORDINGS_KEY = "car-racing-game-recordings"

export default function CarRacingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const keysRef = useRef<Set<string>>(new Set())
  const startTimeRef = useRef<number>(0)
  const lastSaveRef = useRef<number>(0)

  const physicsWorkerRef = useRef<Worker | null>(null)
  const effectsWorkerRef = useRef<Worker | null>(null)
  const [workerSupported, setWorkerSupported] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingStartTimeRef = useRef<number>(0)

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [showRecordings, setShowRecordings] = useState(false)
  const [recordingSupported, setRecordingSupported] = useState(false)

  const [gameState, setGameState] = useState<GameState>({
    car: {
      x: 100,
      y: 300,
      angle: 0,
      speed: 0,
      maxSpeed: 5,
    },
    checkpoints: [
      { x: 300, y: 250, width: 20, height: 100, id: 1, passed: false },
      { x: 600, y: 150, width: 20, height: 100, id: 2, passed: false },
      { x: 900, y: 300, width: 20, height: 100, id: 3, passed: false },
      { x: 700, y: 450, width: 20, height: 100, id: 4, passed: false },
      { x: 400, y: 500, width: 20, height: 100, id: 5, passed: false },
      { x: 50, y: 400, width: 20, height: 100, id: 6, passed: false },
    ],
    currentCheckpoint: 0,
    gameStarted: false,
    gamePaused: false,
    raceTime: 0,
    totalCheckpoints: 6,
    raceCompleted: false,
    isRecording: false,
  })

  const [hasSavedGame, setHasSavedGame] = useState(false)
  const [showResumeOption, setShowResumeOption] = useState(false)
  const [showMainMenu, setShowMainMenu] = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [gameStats, setGameStats] = useState<GameStats>({
    gamesCompleted: 0,
    bestTime: null,
    totalPlayTime: 0,
    checkpointsPassed: 0,
  })

  const saveGame = useCallback((state: GameState) => {
    if (state.raceCompleted || !state.gameStarted) return

    const saveData: SavedGame = {
      car: state.car,
      checkpoints: state.checkpoints,
      currentCheckpoint: state.currentCheckpoint,
      raceTime: state.raceTime,
      savedAt: Date.now(),
      bestTime: state.bestTime,
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
      lastSaveRef.current = Date.now()
    } catch (error) {
      console.error("Error saving game:", error)
    }
  }, [])

  const loadSavedGame = useCallback(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY)
      if (!savedData) return null

      const saveData: SavedGame = JSON.parse(savedData)

      const hoursSinceSave = (Date.now() - saveData.savedAt) / (1000 * 60 * 60)
      if (hoursSinceSave > 24) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }

      return saveData
    } catch (error) {
      console.error("Error loading saved game:", error)
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
  }, [])

  const deleteSavedGame = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setHasSavedGame(false)
      setShowResumeOption(false)
    } catch (error) {
      console.error("Error deleting saved game:", error)
    }
  }, [])

  const saveStats = useCallback((completedTime: number, checkpointsPassed: number) => {
    try {
      const existingStats = localStorage.getItem(STATS_KEY)
      const stats = existingStats
        ? JSON.parse(existingStats)
        : {
            gamesCompleted: 0,
            bestTime: null,
            totalPlayTime: 0,
            checkpointsPassed: 0,
          }

      stats.gamesCompleted += 1
      stats.totalPlayTime += completedTime
      stats.checkpointsPassed += checkpointsPassed

      if (!stats.bestTime || completedTime < stats.bestTime) {
        stats.bestTime = completedTime
      }

      localStorage.setItem(STATS_KEY, JSON.stringify(stats))
      setGameStats(stats)
    } catch (error) {
      console.error("Error saving stats:", error)
    }
  }, [])

  const loadStats = useCallback(() => {
    try {
      const savedStats = localStorage.getItem(STATS_KEY)
      const stats = savedStats
        ? JSON.parse(savedStats)
        : {
            gamesCompleted: 0,
            bestTime: null,
            totalPlayTime: 0,
            checkpointsPassed: 0,
          }
      setGameStats(stats)
      return stats
    } catch (error) {
      console.error("Error loading stats:", error)
      return null
    }
  }, [])

  const loadRecordings = useCallback(() => {
    try {
      const saved = localStorage.getItem(RECORDINGS_KEY)
      if (saved) {
        const parsedRecordings = JSON.parse(saved)
        // Convertir blobs guardados de vuelta a Blob objects
        const recordings = parsedRecordings.map((rec: any) => ({
          ...rec,
          blob: new Blob([new Uint8Array(rec.blobData)], { type: "video/webm" }),
        }))
        setRecordings(recordings)
      }
    } catch (error) {
      console.error("[Game] Error cargando grabaciones:", error)
    }
  }, [])

  const saveRecordings = useCallback((recordings: Recording[]) => {
    try {
      // Convertir blobs a arrays para almacenamiento
      const recordingsToSave = recordings.map(async (rec) => {
        const arrayBuffer = await rec.blob.arrayBuffer()
        return {
          ...rec,
          blobData: Array.from(new Uint8Array(arrayBuffer)),
          blob: undefined,
        }
      })

      Promise.all(recordingsToSave).then((serializedRecordings) => {
        localStorage.setItem(RECORDINGS_KEY, JSON.stringify(serializedRecordings))
      })
    } catch (error) {
      console.error("[Game] Error guardando grabaciones:", error)
    }
  }, [])

  const startScreenRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("La grabación de pantalla no está soportada en este navegador")
        return
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "screen",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })

      recordedChunksRef.current = []
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" })
        const duration = Date.now() - recordingStartTimeRef.current

        const newRecording: Recording = {
          id: Date.now().toString(),
          name: `Carrera ${new Date().toLocaleString()}`,
          blob,
          duration,
          createdAt: Date.now(),
          raceTime: gameState.raceTime,
          checkpointsCompleted: gameState.checkpoints.filter((c) => c.passed).length,
        }

        setRecordings((prev) => {
          const updated = [...prev, newRecording]
          saveRecordings(updated)
          return updated
        })

        // Detener todas las pistas del stream
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      recordingStartTimeRef.current = Date.now()
      mediaRecorder.start(1000) // Grabar en chunks de 1 segundo

      setGameState((prev) => ({ ...prev, isRecording: true }))
    } catch (error) {
      console.error("[Game] Error iniciando grabación:", error)
      alert("Error al iniciar la grabación de pantalla")
    }
  }, [gameState.raceTime, gameState.checkpoints, saveRecordings])

  const stopScreenRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      setGameState((prev) => ({ ...prev, isRecording: false }))
    }
  }, [])

  const deleteRecording = useCallback(
    (recordingId: string) => {
      setRecordings((prev) => {
        const updated = prev.filter((rec) => rec.id !== recordingId)
        saveRecordings(updated)
        return updated
      })
    },
    [saveRecordings],
  )

  const downloadRecording = useCallback((recording: Recording) => {
    const url = URL.createObjectURL(recording.blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${recording.name}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    const savedGame = loadSavedGame()
    if (savedGame) {
      setHasSavedGame(true)
      setShowResumeOption(true)
    }

    const stats = loadStats()
    if (stats && stats.bestTime) {
      setGameState((prev) => ({ ...prev, bestTime: stats.bestTime }))
    }
  }, [loadSavedGame, loadStats])

  useEffect(() => {
    const checkRecordingSupport = () => {
      const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
      setRecordingSupported(supported)
    }

    checkRecordingSupport()
    loadRecordings()
  }, [loadRecordings])

  useEffect(() => {
    if (gameState.gameStarted && !gameState.gamePaused && !gameState.raceCompleted) {
      const interval = setInterval(() => {
        saveGame(gameState)
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [gameState, saveGame])

  const resumeGame = useCallback(() => {
    const savedGame = loadSavedGame()
    if (!savedGame) return

    const timeOffset = Date.now() - savedGame.savedAt
    startTimeRef.current = Date.now() - savedGame.raceTime - timeOffset

    setGameState((prev) => ({
      ...prev,
      car: savedGame.car,
      checkpoints: savedGame.checkpoints,
      currentCheckpoint: savedGame.currentCheckpoint,
      raceTime: savedGame.raceTime,
      gameStarted: true,
      gamePaused: false,
      bestTime: savedGame.bestTime || prev.bestTime,
    }))

    setShowResumeOption(false)
    setShowMainMenu(false)
  }, [loadSavedGame])

  const drawCar = (ctx: CanvasRenderingContext2D, car: Car) => {
    ctx.save()
    ctx.translate(car.x, car.y)
    ctx.rotate(car.angle)

    ctx.fillStyle = "#ff4444"
    ctx.fillRect(-15, -8, 30, 16)

    ctx.fillStyle = "#87ceeb"
    ctx.fillRect(-10, -6, 20, 12)

    ctx.restore()
  }

  const drawCheckpoints = (ctx: CanvasRenderingContext2D, checkpoints: Checkpoint[]) => {
    const currentTime = Date.now()

    checkpoints.forEach((checkpoint, index) => {
      let fillColor = "#6b7280"
      let glowEffect = false

      if (checkpoint.passed) {
        fillColor = "#22c55e"

        if (checkpoint.justPassed && checkpoint.passedTime) {
          const timeSincePassed = currentTime - checkpoint.passedTime
          if (timeSincePassed < 1000) {
            const alpha = 1 - timeSincePassed / 1000
            ctx.shadowColor = "#22c55e"
            ctx.shadowBlur = 20 * alpha
            glowEffect = true
          }
        }
      } else if (index === gameState.currentCheckpoint) {
        const pulse = Math.sin(currentTime * 0.005) * 0.3 + 0.7
        fillColor = `rgba(251, 191, 36, ${pulse})`
        ctx.shadowColor = "#fbbf24"
        ctx.shadowBlur = 15
        glowEffect = true
      }

      ctx.fillStyle = fillColor
      ctx.fillRect(checkpoint.x, checkpoint.y, checkpoint.width, checkpoint.height)

      if (glowEffect) {
        ctx.shadowColor = "transparent"
        ctx.shadowBlur = 0
      }

      ctx.fillStyle = "#ffffff"
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 2
      ctx.font = "bold 16px Arial"
      ctx.textAlign = "center"

      const textX = checkpoint.x + checkpoint.width / 2
      const textY = checkpoint.y + checkpoint.height / 2 + 6

      ctx.strokeText((index + 1).toString(), textX, textY)
      ctx.fillText((index + 1).toString(), textX, textY)

      if (index === gameState.currentCheckpoint && !checkpoint.passed) {
        ctx.fillStyle = "#fbbf24"
        ctx.font = "12px Arial"
        ctx.fillText("SIGUIENTE", textX, checkpoint.y - 10)
      }
    })
  }

  const drawTrack = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas

    ctx.fillStyle = "#22c55e"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = "#374151"
    ctx.fillRect(50, 200, canvas.width - 100, 200)

    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.setLineDash([20, 20])
    ctx.beginPath()
    ctx.moveTo(50, 300)
    ctx.lineTo(canvas.width - 50, 300)
    ctx.stroke()
    ctx.setLineDash([])
  }

  const updateCar = (car: Car) => {
    const keys = keysRef.current

    if (keys.has("w") || keys.has("arrowup")) {
      car.speed = Math.min(car.speed + 0.3, car.maxSpeed)
    } else if (keys.has("s") || keys.has("arrowdown")) {
      car.speed = Math.max(car.speed - 0.3, -car.maxSpeed / 2)
    } else {
      car.speed *= 0.95
    }

    if (Math.abs(car.speed) > 0.1) {
      if (keys.has("a") || keys.has("arrowleft")) {
        car.angle -= 0.05 * (car.speed / car.maxSpeed)
      }
      if (keys.has("d") || keys.has("arrowright")) {
        car.angle += 0.05 * (car.speed / car.maxSpeed)
      }
    }

    car.x += Math.cos(car.angle) * car.speed
    car.y += Math.sin(car.angle) * car.speed

    const canvas = canvasRef.current
    if (canvas) {
      car.x = Math.max(20, Math.min(canvas.width - 20, car.x))
      car.y = Math.max(20, Math.min(canvas.height - 20, car.y))
    }
  }

  const checkCheckpointCollision = (car: Car, checkpoints: Checkpoint[]) => {
    const currentCheckpoint = checkpoints[gameState.currentCheckpoint]
    if (!currentCheckpoint || currentCheckpoint.passed) return

    const carLeft = car.x - 15
    const carRight = car.x + 15
    const carTop = car.y - 8
    const carBottom = car.y + 8

    const checkLeft = currentCheckpoint.x
    const checkRight = currentCheckpoint.x + currentCheckpoint.width
    const checkTop = currentCheckpoint.y
    const checkBottom = currentCheckpoint.y + currentCheckpoint.height

    if (carRight > checkLeft && carLeft < checkRight && carBottom > checkTop && carTop < checkBottom) {
      const currentTime = Date.now()

      setGameState((prev) => {
        const newCheckpoints = [...prev.checkpoints]
        newCheckpoints[prev.currentCheckpoint] = {
          ...newCheckpoints[prev.currentCheckpoint],
          passed: true,
          justPassed: true,
          passedTime: currentTime,
        }

        const nextCheckpoint = prev.currentCheckpoint + 1
        const raceCompleted = nextCheckpoint >= prev.totalCheckpoints

        const newState = {
          ...prev,
          checkpoints: newCheckpoints,
          currentCheckpoint: nextCheckpoint,
          raceCompleted,
          bestTime: raceCompleted && (!prev.bestTime || prev.raceTime < prev.bestTime) ? prev.raceTime : prev.bestTime,
        }

        if (!raceCompleted) {
          setTimeout(() => saveGame(newState), 100)
        } else {
          saveStats(prev.raceTime, prev.totalCheckpoints)
          deleteSavedGame()
        }

        return newState
      })
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase())

      if (e.key === "Escape" && gameState.gameStarted) {
        setGameState((prev) => ({ ...prev, gamePaused: !prev.gamePaused }))
      }
    },
    [gameState.gameStarted],
  )

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key.toLowerCase())
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  const cleanupCheckpointEffects = useCallback(() => {
    const currentTime = Date.now()
    setGameState((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.map((checkpoint) => {
        if (checkpoint.justPassed && checkpoint.passedTime && currentTime - checkpoint.passedTime > 1000) {
          return {
            ...checkpoint,
            justPassed: false,
            passedTime: undefined,
          }
        }
        return checkpoint
      }),
    }))
  }, [])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !gameState.gameStarted || gameState.gamePaused) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawTrack(ctx)
    drawCheckpoints(ctx, gameState.checkpoints)

    // Usar Physics Worker si está disponible
    if (physicsWorkerRef.current && workerSupported) {
      const keys = Array.from(keysRef.current)

      // Enviar datos al Physics Worker para procesamiento en paralelo
      physicsWorkerRef.current.postMessage({
        type: "UPDATE_CAR",
        car: gameState.car,
        keys,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      })

      // Verificar colisiones en Worker
      physicsWorkerRef.current.postMessage({
        type: "CHECK_COLLISION",
        car: gameState.car,
        checkpoints: gameState.checkpoints,
        currentCheckpoint: gameState.currentCheckpoint,
      })
    } else {
      // Fallback al hilo principal si Workers no están disponibles
      const newCar = { ...gameState.car }
      updateCar(newCar)

      if (!gameState.raceCompleted) {
        checkCheckpointCollision(newCar, gameState.checkpoints)
      }

      setGameState((prev) => ({ ...prev, car: newCar }))
    }

    // Procesar efectos en Effects Worker
    if (effectsWorkerRef.current) {
      effectsWorkerRef.current.postMessage({
        type: "PROCESS_EFFECTS",
        deltaTime: 16,
      })
    }

    drawCar(ctx, gameState.car)
    cleanupCheckpointEffects()

    if (gameState.raceCompleted) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 48px Arial"
      ctx.textAlign = "center"
      ctx.fillText("¡CARRERA COMPLETADA!", canvas.width / 2, canvas.height / 2 - 50)

      ctx.font = "24px Arial"
      ctx.fillText(`Tiempo: ${formatTime(gameState.raceTime)}`, canvas.width / 2, canvas.height / 2)

      if (gameState.bestTime && gameState.raceTime === gameState.bestTime) {
        ctx.fillStyle = "#fbbf24"
        ctx.fillText("¡NUEVO RÉCORD!", canvas.width / 2, canvas.height / 2 + 40)
      }
    }

    setGameState((prev) => ({
      ...prev,
      raceTime: gameState.raceCompleted ? prev.raceTime : Date.now() - startTimeRef.current,
    }))

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [gameState, workerSupported, cleanupCheckpointEffects])

  useEffect(() => {
    if (gameState.gameStarted && !gameState.gamePaused) {
      animationRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameLoop, gameState.gameStarted, gameState.gamePaused])

  const startGame = () => {
    startTimeRef.current = Date.now()
    setGameState((prev) => ({ ...prev, gameStarted: true, gamePaused: false }))
    setShowResumeOption(false)
    setShowMainMenu(false)

    if (recordingSupported) {
      setTimeout(() => {
        startScreenRecording()
      }, 1000) // Delay de 1 segundo para que el juego se estabilice
    }
  }

  const pauseGame = () => {
    setGameState((prev) => ({ ...prev, gamePaused: !prev.gamePaused }))
  }

  const resetGame = () => {
    if (gameState.isRecording) {
      stopScreenRecording()
    }

    deleteSavedGame()
    setGameState((prev) => ({
      car: { x: 100, y: 300, angle: 0, speed: 0, maxSpeed: 5 },
      checkpoints: [
        { x: 300, y: 250, width: 20, height: 100, id: 1, passed: false },
        { x: 600, y: 150, width: 20, height: 100, id: 2, passed: false },
        { x: 900, y: 300, width: 20, height: 100, id: 3, passed: false },
        { x: 700, y: 450, width: 20, height: 100, id: 4, passed: false },
        { x: 400, y: 500, width: 20, height: 100, id: 5, passed: false },
        { x: 50, y: 400, width: 20, height: 100, id: 6, passed: false },
      ],
      currentCheckpoint: 0,
      gameStarted: false,
      gamePaused: false,
      raceTime: 0,
      totalCheckpoints: 6,
      raceCompleted: false,
      bestTime: prev.bestTime,
      isRecording: false,
    }))
    setShowMainMenu(true)
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`
  }

  const MainMenu = () => (
    <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10">
      <Card className="p-8 max-w-md w-full mx-4">
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold text-primary">Juego de Carros</h2>
          <p className="text-muted-foreground">Completa todos los checkpoints en el menor tiempo posible</p>

          <div className="space-y-3">
            {hasSavedGame && (
              <Button onClick={resumeGame} className="w-full bg-blue-600 hover:bg-blue-700">
                Continuar Partida
              </Button>
            )}

            <Button onClick={startGame} className="w-full bg-green-600 hover:bg-green-700">
              Nueva Partida
            </Button>

            <Button onClick={() => setShowStats(true)} variant="outline" className="w-full">
              Estadísticas
            </Button>

            <Button onClick={() => setShowInstructions(true)} variant="outline" className="w-full">
              Instrucciones
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )

  const PauseMenu = () => (
    <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10">
      <Card className="p-6 max-w-sm w-full mx-4">
        <div className="text-center space-y-4">
          <h3 className="text-2xl font-bold">Juego Pausado</h3>

          <div className="space-y-2">
            <Button onClick={pauseGame} className="w-full bg-green-600 hover:bg-green-700">
              Reanudar
            </Button>

            <Button onClick={resetGame} variant="outline" className="w-full bg-transparent">
              Menú Principal
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">Presiona ESC para pausar/reanudar</p>
        </div>
      </Card>
    </div>
  )

  const saveGameAsync = useCallback(async (state: GameState) => {
    if (state.raceCompleted || !state.gameStarted) return

    const saveData: SavedGame = {
      car: state.car,
      checkpoints: state.checkpoints,
      currentCheckpoint: state.currentCheckpoint,
      raceTime: state.raceTime,
      savedAt: Date.now(),
      bestTime: state.bestTime,
    }

    try {
      // Guardado asíncrono no bloqueante
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
            lastSaveRef.current = Date.now()

            // Registrar sincronización en segundo plano si está offline
            if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
              navigator.serviceWorker.ready.then((registration) => {
                if (registration.sync) {
                  registration.sync.register("background-save")
                }
              })
            }

            resolve()
          } catch (error) {
            reject(error)
          }
        }, 0) // Usar setTimeout para hacer la operación asíncrona
      })

      console.log("[Game] Partida guardada asincrónicamente")
    } catch (error) {
      console.error("[Game] Error en guardado asíncrono:", error)
    }
  }, [])

  const handleCheckpointCollision = useCallback(
    (checkpointId: number) => {
      const currentTime = Date.now()

      // Agregar efecto visual usando Effects Worker
      if (effectsWorkerRef.current) {
        effectsWorkerRef.current.postMessage({
          type: "ADD_EFFECT",
          newEffect: {
            type: "GLOW",
            x: gameState.car.x,
            y: gameState.car.y,
            intensity: 1.0,
            color: "#22c55e",
            duration: 1000,
          },
        })
      }

      setGameState((prev) => {
        const newCheckpoints = [...prev.checkpoints]
        newCheckpoints[prev.currentCheckpoint] = {
          ...newCheckpoints[prev.currentCheckpoint],
          passed: true,
          justPassed: true,
          passedTime: currentTime,
        }

        const nextCheckpoint = prev.currentCheckpoint + 1
        const raceCompleted = nextCheckpoint >= prev.totalCheckpoints

        const newState = {
          ...prev,
          checkpoints: newCheckpoints,
          currentCheckpoint: nextCheckpoint,
          raceCompleted,
          bestTime: raceCompleted && (!prev.bestTime || prev.raceTime < prev.bestTime) ? prev.raceTime : prev.bestTime,
        }

        // Guardado asíncrono
        if (!raceCompleted) {
          saveGameAsync(newState)
        } else {
          saveStats(prev.raceTime, prev.totalCheckpoints)
          deleteSavedGame()
        }

        return newState
      })
    },
    [gameState.car, saveGameAsync],
  )

  const createPhysicsWorker = useCallback(() => {
    const workerScript = `
      self.onmessage = function(e) {
        const { type, car, keys = [], checkpoints = [], currentCheckpoint = 0, canvasWidth = 1000, canvasHeight = 600 } = e.data

        if (type === 'UPDATE_CAR' && car) {
          const updatedCar = { ...car }
          
          // Aceleración/frenado
          if (keys.includes('w') || keys.includes('arrowup')) {
            updatedCar.speed = Math.min(updatedCar.speed + 0.3, updatedCar.maxSpeed)
          } else if (keys.includes('s') || keys.includes('arrowdown')) {
            updatedCar.speed = Math.max(updatedCar.speed - 0.3, -updatedCar.maxSpeed / 2)
          } else {
            updatedCar.speed *= 0.95
          }

          // Dirección
          if (Math.abs(updatedCar.speed) > 0.1) {
            if (keys.includes('a') || keys.includes('arrowleft')) {
              updatedCar.angle -= 0.05 * (updatedCar.speed / updatedCar.maxSpeed)
            }
            if (keys.includes('d') || keys.includes('arrowright')) {
              updatedCar.angle += 0.05 * (updatedCar.speed / updatedCar.maxSpeed)
            }
          }

          // Movimiento
          updatedCar.x += Math.cos(updatedCar.angle) * updatedCar.speed
          updatedCar.y += Math.sin(updatedCar.angle) * updatedCar.speed

          // Límites del canvas
          updatedCar.x = Math.max(20, Math.min(canvasWidth - 20, updatedCar.x))
          updatedCar.y = Math.max(20, Math.min(canvasHeight - 20, updatedCar.y))

          self.postMessage({ type: 'CAR_UPDATED', car: updatedCar })
        }

        if (type === 'CHECK_COLLISION' && car && checkpoints.length > 0) {
          const checkpoint = checkpoints[currentCheckpoint]
          if (!checkpoint || checkpoint.passed) return

          const carLeft = car.x - 15
          const carRight = car.x + 15
          const carTop = car.y - 8
          const carBottom = car.y + 8

          const checkLeft = checkpoint.x
          const checkRight = checkpoint.x + checkpoint.width
          const checkTop = checkpoint.y
          const checkBottom = checkpoint.y + checkpoint.height

          const collision = carRight > checkLeft && carLeft < checkRight && 
                           carBottom > checkTop && carTop < checkBottom

          if (collision) {
            self.postMessage({ type: 'COLLISION_DETECTED', checkpointId: checkpoint.id })
          }
        }
      }
    `

    const blob = new Blob([workerScript], { type: "application/javascript" })
    return new Worker(URL.createObjectURL(blob))
  }, [])

  const createEffectsWorker = useCallback(() => {
    const workerScript = `
      let activeEffects = []

      self.onmessage = function(e) {
        const { type, effects = [], newEffect, deltaTime = 16 } = e.data

        if (type === 'ADD_EFFECT' && newEffect) {
          activeEffects.push({
            ...newEffect,
            duration: newEffect.duration || 1000
          })
        }

        if (type === 'PROCESS_EFFECTS') {
          activeEffects = activeEffects
            .map(effect => ({
              ...effect,
              duration: (effect.duration || 0) - deltaTime,
              intensity: effect.intensity ? effect.intensity * 0.98 : 1
            }))
            .filter(effect => (effect.duration || 0) > 0)

          self.postMessage({ 
            type: 'EFFECTS_PROCESSED', 
            effects: activeEffects 
          })
        }
      }
    `

    const blob = new Blob([workerScript], { type: "application/javascript" })
    return new Worker(URL.createObjectURL(blob))
  }, [])

  const registerServiceWorker = useCallback(async () => {
    if ("serviceWorker" in navigator) {
      const swScript = `
        const CACHE_NAME = 'car-racing-game-v1'
        const urlsToCache = [
          '/',
          '/static/js/bundle.js',
          '/static/css/main.css'
        ]

        self.addEventListener('install', function(event) {
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then(function(cache) {
                console.log('[SW] Cache abierto')
                return cache.addAll(urlsToCache)
              })
          )
        })

        self.addEventListener('fetch', function(event) {
          event.respondWith(
            caches.match(event.request)
              .then(function(response) {
                if (response) {
                  return response
                }
                
                return fetch(event.request).then(function(response) {
                  if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response
                  }

                  const responseToCache = response.clone()
                  
                  caches.open(CACHE_NAME)
                    .then(function(cache) {
                      cache.put(event.request, responseToCache)
                    })

                  return response
                })
              })
          )
        })

        self.addEventListener('sync', function(event) {
          if (event.tag === 'background-save') {
            event.waitUntil(
              new Promise((resolve) => {
                console.log('[SW] Ejecutando guardado en segundo plano')
                setTimeout(resolve, 1000)
              })
            )
          }
        })
      `

      try {
        const blob = new Blob([swScript], { type: "application/javascript" })
        const swUrl = URL.createObjectURL(blob)

        const registration = await navigator.serviceWorker.register(swUrl)
        console.log("[Game] Service Worker registrado:", registration.scope)
      } catch (error) {
        console.log("[Game] Error registrando Service Worker:", error)
      }
    }
  }, [])

  useEffect(() => {
    // Verificar soporte para Workers
    if (typeof Worker !== "undefined") {
      setWorkerSupported(true)

      // Inicializar Physics Worker
      try {
        physicsWorkerRef.current = createPhysicsWorker()
        physicsWorkerRef.current.onmessage = (e) => {
          const { type, car, checkpointId } = e.data

          if (type === "CAR_UPDATED" && car) {
            setGameState((prev) => ({ ...prev, car }))
          }

          if (type === "COLLISION_DETECTED") {
            handleCheckpointCollision(checkpointId)
          }
        }
      } catch (error) {
        console.log("[Game] Physics Worker no disponible, usando hilo principal")
        setWorkerSupported(false)
      }

      // Inicializar Effects Worker
      try {
        effectsWorkerRef.current = createEffectsWorker()
        effectsWorkerRef.current.onmessage = (e) => {
          const { type, effects } = e.data
          if (type === "EFFECTS_PROCESSED") {
            console.log("[Game] Efectos procesados:", effects.length)
          }
        }
      } catch (error) {
        console.log("[Game] Effects Worker no disponible")
      }
    }

    // Registrar Service Worker
    registerServiceWorker()

    // Detectar modo offline
    const handleOnline = () => setOfflineMode(false)
    const handleOffline = () => setOfflineMode(true)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    setOfflineMode(!navigator.onLine)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)

      // Limpiar workers
      if (physicsWorkerRef.current) {
        physicsWorkerRef.current.terminate()
      }
      if (effectsWorkerRef.current) {
        effectsWorkerRef.current.terminate()
      }
    }
  }, [createPhysicsWorker, createEffectsWorker, registerServiceWorker, handleCheckpointCollision])

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6 text-white">🏎️ Juego de Carros con Checkpoints</h1>

      <Dialog open={showRecordings} onOpenChange={setShowRecordings}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📹 Grabaciones de Partidas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {recordings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay grabaciones disponibles. Las grabaciones se crean automáticamente al iniciar una partida.
              </p>
            ) : (
              recordings.map((recording) => (
                <div key={recording.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{recording.name}</h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Duración: {Math.round(recording.duration / 1000)}s</p>
                        <p>Tiempo de carrera: {formatTime(recording.raceTime)}</p>
                        <p>Checkpoints completados: {recording.checkpointsCompleted}/6</p>
                        <p>Creado: {new Date(recording.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-x-2">
                      <Button
                        onClick={() => downloadRecording(recording)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Descargar
                      </Button>
                      <Button onClick={() => deleteRecording(recording.id)} size="sm" variant="destructive">
                        Eliminar
                      </Button>
                    </div>
                  </div>
                  <video
                    controls
                    className="w-full max-h-64 bg-black rounded"
                    src={URL.createObjectURL(recording.blob)}
                  />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMainMenu} onOpenChange={setShowMainMenu}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🏁 Menú Principal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={() => {
                setShowMainMenu(false)
                if (!gameState.gameStarted) startGame()
              }}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {gameState.gameStarted ? "Continuar Partida" : "Nueva Partida"}
            </Button>

            {recordingSupported && (
              <Button
                onClick={() => {
                  setShowMainMenu(false)
                  setShowRecordings(true)
                }}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                📹 Ver Grabaciones ({recordings.length})
              </Button>
            )}

            <Button
              onClick={() => {
                setShowMainMenu(false)
                setShowStats(true)
              }}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              📊 Estadísticas
            </Button>

            <Button
              onClick={() => {
                setShowMainMenu(false)
                setShowInstructions(true)
              }}
              className="w-full bg-gray-600 hover:bg-gray-700"
            >
              ❓ Instrucciones
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2 mb-2">
        <Badge variant={workerSupported ? "default" : "secondary"} className="text-xs">
          {workerSupported ? "✓ Web Workers" : "✗ Web Workers"}
        </Badge>
        <Badge variant={offlineMode ? "destructive" : "default"} className="text-xs">
          {offlineMode ? "Offline" : "Online"}
        </Badge>
        <Badge variant="default" className="text-xs bg-blue-600 text-white">
          Async Save
        </Badge>
      </div>

      {gameState.gamePaused && gameState.gameStarted && <PauseMenu />}

      <Dialog open={showStats} onOpenChange={setShowStats}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Estadísticas del Juego</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{gameStats.gamesCompleted}</div>
                <div className="text-sm text-muted-foreground">Carreras Completadas</div>
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {gameStats.bestTime ? formatTime(gameStats.bestTime) : "--:--"}
                </div>
                <div className="text-sm text-muted-foreground">Mejor Tiempo</div>
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{gameStats.checkpointsPassed}</div>
                <div className="text-sm text-muted-foreground">Checkpoints Pasados</div>
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{formatTime(gameStats.totalPlayTime)}</div>
                <div className="text-sm text-muted-foreground">Tiempo Total</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Instrucciones</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Controles:</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  • <strong>W / Flecha Arriba:</strong> Acelerar
                </li>
                <li>
                  • <strong>S / Flecha Abajo:</strong> Frenar/Reversa
                </li>
                <li>
                  • <strong>A / Flecha Izquierda:</strong> Girar izquierda
                </li>
                <li>
                  • <strong>D / Flecha Derecha:</strong> Girar derecha
                </li>
                <li>
                  • <strong>ESC:</strong> Pausar/Reanudar
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Objetivo:</h4>
              <p className="text-sm text-muted-foreground">
                Pasa por todos los checkpoints en orden numérico en el menor tiempo posible. El progreso se guarda
                automáticamente cada 5 segundos.
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Checkpoints:</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  • <span className="inline-block w-3 h-3 bg-yellow-500 rounded mr-2"></span>Siguiente objetivo
                </li>
                <li>
                  • <span className="inline-block w-3 h-3 bg-green-500 rounded mr-2"></span>Completado
                </li>
                <li>
                  • <span className="inline-block w-3 h-3 bg-gray-500 rounded mr-2"></span>Pendiente
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="p-4">
        {showResumeOption && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900">Partida guardada encontrada</h3>
                <p className="text-sm text-blue-700">
                  Tienes una carrera en progreso. ¿Quieres continuar desde donde la dejaste?
                </p>
              </div>
              <div className="space-x-2">
                <Button onClick={resumeGame} className="bg-blue-600 hover:bg-blue-700">
                  Reanudar
                </Button>
                <Button onClick={() => setShowResumeOption(false)} variant="outline">
                  Nueva partida
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="space-x-2">
            {!gameState.gameStarted ? (
              <Button onClick={() => setShowMainMenu(true)} className="bg-blue-600 hover:bg-blue-700">
                Menú Principal
              </Button>
            ) : (
              <>
                <Button onClick={pauseGame} className="bg-yellow-600 hover:bg-yellow-700">
                  {gameState.gamePaused ? "Reanudar" : "Pausar"}
                </Button>
                <Button onClick={resetGame} variant="outline">
                  Menú Principal
                </Button>
              </>
            )}
          </div>

          <div className="text-right space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Progreso: {gameState.checkpoints.filter((c) => c.passed).length} / {gameState.totalCheckpoints}
              </span>
              {gameState.gameStarted && !gameState.raceCompleted && (
                <Badge variant="secondary" className="text-xs bg-blue-600 text-white">
                  Auto-guardado
                </Badge>
              )}
              {gameState.isRecording && (
                <Badge variant="secondary" className="text-xs bg-red-600 text-white animate-pulse">
                  🔴 Grabando
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">Tiempo: {formatTime(gameState.raceTime)}</div>
            {gameState.bestTime && (
              <div className="text-sm text-muted-foreground">Mejor: {formatTime(gameState.bestTime)}</div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progreso de la carrera</span>
            <span>
              {Math.round((gameState.checkpoints.filter((c) => c.passed).length / gameState.totalCheckpoints) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(gameState.checkpoints.filter((c) => c.passed).length / gameState.totalCheckpoints) * 100}%`,
              }}
            />
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          className="border border-gray-300 bg-green-500 w-full max-w-full h-auto"
        />

        <div className="mt-4 text-sm text-muted-foreground text-center">
          Controles: WASD o Flechas para mover el carro • ESC para pausar
          <br />
          <span className="text-xs">El progreso se guarda automáticamente cada 5 segundos</span>
        </div>
      </Card>
    </div>
  )
}
