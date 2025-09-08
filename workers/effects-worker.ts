interface EffectData {
  type: "PARTICLE" | "GLOW" | "TRAIL"
  x: number
  y: number
  intensity?: number
  color?: string
  duration?: number
}

interface EffectsMessage {
  type: "PROCESS_EFFECTS" | "ADD_EFFECT"
  effects?: EffectData[]
  newEffect?: EffectData
  deltaTime?: number
}

let activeEffects: EffectData[] = []

self.onmessage = (e: MessageEvent<EffectsMessage>) => {
  const { type, effects = [], newEffect, deltaTime = 16 } = e.data

  if (type === "ADD_EFFECT" && newEffect) {
    // Agregar nuevo efecto al procesamiento en segundo plano
    activeEffects.push({
      ...newEffect,
      duration: newEffect.duration || 1000,
    })
  }

  if (type === "PROCESS_EFFECTS") {
    // Procesar efectos en hilo separado
    activeEffects = activeEffects
      .map((effect) => ({
        ...effect,
        duration: (effect.duration || 0) - deltaTime,
        intensity: effect.intensity ? effect.intensity * 0.98 : 1,
      }))
      .filter((effect) => (effect.duration || 0) > 0)

    // Enviar efectos procesados de vuelta
    self.postMessage({
      type: "EFFECTS_PROCESSED",
      effects: activeEffects,
    })
  }
}
