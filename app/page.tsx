import CarRacingGame from "@/components/car-racing-game"

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-white text-center mb-8">Juego de Carros con Checkpoints</h1>
        <CarRacingGame />
      </div>
    </main>
  )
}
