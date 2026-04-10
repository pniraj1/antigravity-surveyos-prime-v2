# State Management

SurveyOS uses `Zustand` to orchestrate rapid, memory-optimized state management.

## Stores

### `claim-store`
- The single source of truth for the currently opened working claim (`currentClaim`).
- Handles complex updates for Arrays (e.g. Assessment parts) dynamically via utility reducers (`updateSection`, `addRow`, etc.)
- Drives UI bindings via constant `subscribe` patterns rather than React Context.

### `ui-store`
- Orchestrates transient visual data (e.g., active tabs, dialog states, sidebar toggles).

### `profile-store`
- Contains persistent user information (e.g., Surveyor names, affiliations).
- Controls the core counters applied via [[Sequential_Numbering]].
