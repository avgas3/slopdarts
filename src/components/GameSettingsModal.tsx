import { useActiveGame, useGameStore } from "../state/store";

export default function GameSettingsModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useGameStore();
  const active = useActiveGame();
  if (!active) return null;
  const { module, settings } = active;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">GAME SETTINGS</span>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="card game-card modal-summary">
          <div className="card-head">
            <span className="card-title">{module.title}</span>
          </div>
          <p className="tile-desc">{module.description}</p>
          <button
            className="btn btn-outline"
            onClick={() => {
              onClose();
              dispatch({ type: "BACK_TO_SELECT" });
            }}
          >
            Change →
          </button>
        </div>

        {module.settingsFields.map((field) => (
          <div className="settings-group" key={field.key}>
            <span className="settings-label">{field.label}</span>
            <div className="segmented">
              {field.options.map((opt) => (
                <button
                  key={String(opt.value)}
                  className={`segmented-opt ${settings[field.key] === opt.value ? "active" : ""}`}
                  onClick={() =>
                    dispatch({ type: "SET_SETTINGS", kind: module.kind, patch: { [field.key]: opt.value } })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button className="btn btn-primary btn-lg modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
