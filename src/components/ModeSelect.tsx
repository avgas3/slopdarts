import { GAME_LIST } from "../games/registry";
import { useGameStore } from "../state/store";

export default function ModeSelect() {
  const { dispatch } = useGameStore();

  return (
    <div className="screen mode-select">
      <h1 className="page-title">
        <span className="page-title-icon">✦</span> SELECT GAME MODE
      </h1>

      <div className="tile-grid">
        {GAME_LIST.map((module) => (
          <button key={module.kind} className="tile" onClick={() => dispatch({ type: "SELECT_MODE", mode: module.kind })}>
            <div className="tile-head">
              <span className="tile-title">{module.title}</span>
            </div>
            <p className="tile-desc">{module.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
