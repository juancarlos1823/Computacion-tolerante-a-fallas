interface CarData {
  x: number
  y: number
  angle: number
  speed: number
  maxSpeed: number
}

interface PhysicsMessage {
  type: "UPDATE_CAR" | "CHECK_COLLISION"
  car?: CarData
  keys?: string[]
  checkpoints?: any[]
  currentCheckpoint?: number
  canvasWidth?: number
  canvasHeight?: number
}

// Procesamiento de física en hilo separado
self.onmessage = (e: MessageEvent<PhysicsMessage>) => {
  const {
    type,
    car,
    keys = [],
    checkpoints = [],
    currentCheckpoint = 0,
    canvasWidth = 1000,
    canvasHeight = 600,
  } = e.data

  if (type === "UPDATE_CAR" && car) {
    // Cálculos de física del carro en hilo separado
    const updatedCar = { ...car }

    // Aceleración/frenado
    if (keys.includes("w") || keys.includes("arrowup")) {
      updatedCar.speed = Math.min(updatedCar.speed + 0.3, updatedCar.maxSpeed)
    } else if (keys.includes("s") || keys.includes("arrowdown")) {
      updatedCar.speed = Math.max(updatedCar.speed - 0.3, -updatedCar.maxSpeed / 2)
    } else {
      updatedCar.speed *= 0.95
    }

    // Dirección
    if (Math.abs(updatedCar.speed) > 0.1) {
      if (keys.includes("a") || keys.includes("arrowleft")) {
        updatedCar.angle -= 0.05 * (updatedCar.speed / updatedCar.maxSpeed)
      }
      if (keys.includes("d") || keys.includes("arrowright")) {
        updatedCar.angle += 0.05 * (updatedCar.speed / updatedCar.maxSpeed)
      }
    }

    // Movimiento
    updatedCar.x += Math.cos(updatedCar.angle) * updatedCar.speed
    updatedCar.y += Math.sin(updatedCar.angle) * updatedCar.speed

    // Límites del canvas
    updatedCar.x = Math.max(20, Math.min(canvasWidth - 20, updatedCar.x))
    updatedCar.y = Math.max(20, Math.min(canvasHeight - 20, updatedCar.y))

    // Enviar resultado de vuelta al hilo principal
    self.postMessage({ type: "CAR_UPDATED", car: updatedCar })
  }

  if (type === "CHECK_COLLISION" && car && checkpoints.length > 0) {
    const checkpoint = checkpoints[currentCheckpoint]
    if (!checkpoint || checkpoint.passed) return

    // Detección de colisión en hilo separado
    const carLeft = car.x - 15
    const carRight = car.x + 15
    const carTop = car.y - 8
    const carBottom = car.y + 8

    const checkLeft = checkpoint.x
    const checkRight = checkpoint.x + checkpoint.width
    const checkTop = checkpoint.y
    const checkBottom = checkpoint.y + checkpoint.height

    const collision = carRight > checkLeft && carLeft < checkRight && carBottom > checkTop && carTop < checkBottom

    if (collision) {
      self.postMessage({ type: "COLLISION_DETECTED", checkpointId: checkpoint.id })
    }
  }
}
