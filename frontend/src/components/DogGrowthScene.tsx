// Component name retained from the plan; the current design intentionally has no plant.
export function DogGrowthScene({ message }: { message: string }) {
  return (
    <div className="dog-scene">
      <p className="speech-bubble">{message}</p>
      <div className="dog-shadow" aria-hidden="true" />
      <div className="dog" role="img" aria-label="青緑のしましま服を着た黒い犬が、そっと首をかしげています">
        <img className="dog-body" src="/assets/jikkun.png" alt="" width="1254" height="1254" draggable="false" />
        <div className="dog-head" aria-hidden="true">
          <img src="/assets/jikkun.png" alt="" width="1254" height="1254" draggable="false" />
          <img className="dog-blink" src="/assets/jikkun-blink.png" alt="" width="1254" height="1254" draggable="false" />
        </div>
      </div>
    </div>
  )
}
