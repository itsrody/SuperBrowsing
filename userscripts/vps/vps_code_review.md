# Video Progress Saver (VPS) - Code Review and Maintenance Guide

## 1. Introduction

This document provides a comprehensive guide for developers contributing to the Video Progress Saver (VPS) userscript. Its purpose is to ensure that the codebase remains clean, robust, maintainable, and consistent as it evolves.

Adhering to these guidelines is crucial for efficient development, easy debugging, and seamless collaboration.

---

## 2. Core Architecture

The script is built on a modular architecture, where each component has a distinct and well-defined responsibility. This separation of concerns is key to the script's stability and scalability. All modules are encapsulated within an IIFE (Immediately Invoked Function Expression) to prevent polluting the global scope.

- **`CONFIG` (Constant)**
  - **Responsibility:** A centralized, read-only object for storing static configuration values like save intervals, minimum video duration, and storage keys.
  - **Maintenance:** All "magic numbers" or configurable settings should be placed here to allow for easy tuning.

- **`UI_STYLES` (Constant)**
  - **Responsibility:** A template literal string holding all the CSS for the script's UI components. It defines the "glassmorphism" style for the restore toast and the custom dialog system.
  - **Maintenance:** All styling changes, including animations and new UI elements, should be defined here. `GM_addStyle` injects this into the page on startup.

- **`Dialog` (Module)**
  - **Responsibility:** Manages all custom user-facing dialogs, replacing native `alert`, `confirm`, and `prompt` calls. It provides a consistent, styled interface for user interaction, including confirmations and complex forms for configuration. It also ensures that only one dialog is visible at a time by automatically closing any existing panel when a new one is opened.
  - **Maintenance:** This module is the single source for creating modals. Changes to the look and feel of forms and alerts should be made here.

- **`Firebase` (Module)**
  - **Responsibility:** Handles all communication with the Firebase Realtime Database via its REST API. It is responsible for getting and setting individual records, as well as fetching and pushing the entire dataset for the manual sync process.
  - **Maintenance:** All network logic for remote synchronization is contained here. It reads its configuration from storage, which is set via the `Dialog` and `Menu` modules.

- **`Storage` (Module)**
  - **Responsibility:** Abstracts all data persistence logic. It acts as a hybrid controller for both local storage (via Tampermonkey's `GM_getValue`/`GM_setValue` APIs) and remote storage (via the `Firebase` module).
  - **Maintenance:** This is the single source of truth for data operations. When fetching data, it retrieves both local and remote copies and returns the most recent one. When writing data, it writes to both local storage and Firebase (if enabled).

- **`UI` (Module)**
  - **Responsibility:** Manages the "progress restored" toast notification. It is responsible for injecting the UI styles into the page.
  - **Maintenance:** Any changes to the auto-hiding toast notification should be implemented here.

- **`VideoManager` (Module)**
  - **Responsibility:** The brain of the userscript. It handles:
    1.  **Discovery:** Detecting `<video>` elements, both on initial load and those added dynamically (via `MutationObserver`). It includes special logic to ignore YouTube's thumbnail preview videos, only tracking the main video on a watch page.
    2.  **Tracking:** Attaching event listeners (`loadedmetadata`, `timeupdate`, `pause`) to videos.
    3.  **Logic:** Deciding when to save or restore progress based on user actions and `CONFIG` settings. The script only tracks videos strictly longer than the configured minimum duration.
    4.  **Data Gathering:** Collecting video metadata and calling the `Storage` module to save it.
  - **Maintenance:** This is where the core video-related logic resides. When fixing bugs related to progress saving/restoring, this is the first place to look.

- **`Menu` (Module)**
  - **Responsibility:** Initializes and handles all Tampermonkey menu commands (e.g., ⚙️ Configure Sync, 🔄 Sync Now, 👁️ Watching History). It uses the `Dialog` module to present the UI for these actions. The "Watching History" dialog also contains functionality for importing, exporting, and clearing progress data.
  - **Maintenance:** New top-level user-triggered actions should be added here via `GM_registerMenuCommand`. Logic within this module should be restricted to the top-level window to avoid duplicate dialogs.

---

## 3. Code Review Checklist

Before merging any new code, ensure it meets the following criteria:

- [ ] **Architectural Integrity:**
  - Does the new code respect the modular architecture? (e.g., UI code is in `Dialog`/`UI`, storage logic is in `Storage`, Firebase logic is in `Firebase`).
  - Are new features implemented in the correct module?

- [ ] **Robustness & Error Handling:**
  - Is there proper handling for potential `null` or `undefined` values?
  - Is `try...catch` used for operations that might fail (e.g., network requests, parsing imported JSON)?
  - Does the code gracefully handle edge cases (e.g., videos shorter than the minimum duration, iframes with restricted access)?

- [ ] **Correctness & Logic:**
  - **Iframe Context:** UI-blocking actions, especially opening dialogs via the `Menu` module, **must** be guarded to run only in the top-level window (`if (window.self !== window.top) return;`). This prevents duplicate dialogs from appearing. Core logic in `VideoManager` must be allowed to run in iframes to track embedded videos.
  - **Keying Strategy:** The script uses `window.top.location.href` as the default key. However, for specific sites like YouTube, Vimeo, and Twitch, a more robust, site-specific key (e.g., `youtube_<VIDEO_ID>`) is generated. Ensure this logic is maintained and extended for other complex sites if necessary.
  - **Site-Specific Logic:** For sites like YouTube, the script contains specific logic to differentiate between main content and secondary content (e.g., thumbnail previews). When adding features or fixing bugs for a specific site, check `VideoManager.discoverVideos` for existing logic.
  - **Data Integrity:** The data saved (`pageTitle`, `pageUrl`) must come from the top-level window (`window.top`) to ensure the user sees the correct context.

- [ ] **Clarity & Style:**
  - Is the code easy to read and understand?
  - Does it follow established coding conventions (see below)?
  - Are comments added for complex or non-obvious logic?

---

## 4. Coding Style and Conventions

- **Formatting:** Code should be formatted consistently (similar to Prettier defaults: 4-space indentation, trailing commas, etc.).
- **Naming:**
  - **Modules:** `PascalCase` (e.g., `VideoManager`).
  - **Functions/Variables:** `camelCase` (e.g., `getVideoKey`).
  - **Constants:** `UPPER_SNAKE_CASE` (e.g., `CONFIG`).
- **Asynchronous Code:** `async/await` is the standard for all asynchronous operations. Avoid using `.then()` chains for better readability.
- **Comments:** Use block comments (`/** ... */`) to describe the purpose of modules and complex functions. Use inline comments (`//`) to clarify individual lines or short blocks.

---

## 5. Maintenance and Debugging

- **Inspecting, Exporting, and Importing Data:** The **Watching History** menu command opens a powerful dialog to manage your viewing history.
    - **View and Find:** It displays all tracked videos. You can use the **search bar** at the top to instantly filter by title, or use the **dropdown menu** to sort the list by criteria like "Last Updated," "Title," or "Progress."
    - **Manage Entries:**
        - **Single Deletion:** Hover over any item to reveal a trash icon to delete it individually.
        - **Bulk Deletion:** Use the checkboxes on the left to select multiple entries. A bulk actions bar will appear, allowing you to delete all selected items at once.
    - **Data Management:** The header icons remain for top-level actions:
        - **Export All Progress:** Click the export icon to download a readable JSON file of all locally tracked videos.
        - **Import All Progress:** Click the import icon to upload a previously exported JSON file. This will overwrite existing local data.
        - **Clear Local Progress:** Click the trash icon to delete all locally saved progress. This does not affect remote Firebase data.

- **Firebase Sync:**
    - **Configuration:** Use the **Configure Sync** menu command to set up synchronization. This opens a user-friendly form to input your Firebase project details. Each field includes a description and placeholder text.
    - **Connection Testing:** Before saving, you can use the **Test Connection** button to verify that the script can successfully connect to your Firebase database with the provided details. This helps prevent saving invalid configurations.
    - **Required Fields:** Only the `Database URL` and `Collection Path` are strictly required for the sync to function.
    - **Manual Sync:** The **Sync Now** command performs a full, two-way merge. It fetches all data from Firebase, merges it with your local data (keeping the newest entry for each video), and then updates both local storage and Firebase with the merged result.

- **Browser Console:** The script uses `console.warn` and `console.error` for non-critical issues and failed network requests. Check the developer console for these messages when debugging.

- **Dynamic Videos:** If a video isn't being tracked, verify that the `MutationObserver` in `VideoManager` is correctly identifying the element when it's added to the DOM.d network requests. Check the developer console for these messages when debugging.

- **Dynamic Videos:** If a video isn't being tracked, verify that the `MutationObserver` in `VideoManager` is correctly identifying the element when it's added to the DOM.

---

---

## 6. Version History

*   **2.8.0 (Current)**
    *   **Feature:** Forced a right-to-left (RTL) layout for all UI components.
*   **2.7.0**
    *   **Feature:** UI now respects the host page's text direction (LTR/RTL). Removed forceful LTR styling to allow the panel to render correctly on RTL websites.
*   **2.6.3**
    *   **Bug Fix:** Added `!important` to the `direction: ltr` rule to ensure it overrides aggressive RTL styles from host websites.
*   **2.6.2**
    *   **Bug Fix:** Implemented a more robust fix for RTL websites by applying `direction: ltr` to all panel descendants, ensuring layout consistency.
*   **2.6.1**
    *   **Bug Fix:** Forced a left-to-right (`ltr`) direction on all UI elements to prevent layout issues on RTL websites.
*   **2.6.0**
    *   **UX Improvement:** Replaced button labels with icons on mobile view in the 'Configure Sync' panel for a cleaner interface.
*   **2.5.0**
    *   **Refactor:** Restructured the `showHistory` function in the `Menu` module to improve readability and maintainability. The function is now broken down into smaller, more focused helper functions.
*   **2.4.1**
    *   **Bug Fix:** Fixed a UI bug in the mobile view of the "Watching History" panel where the delete button would overlap the favicon.
*   **2.4.0**
    *   **UX Improvement:** Further refined the mobile layout for the "Watching History" panel, using a grid system for a more compact and readable view.
    *   **UX Improvement:** Implemented a slide-from-bottom animation for dialogs on mobile, providing a more native feel.
    *   **UI Polish:** Adjusted the dialog footer on mobile to be a fixed bar with evenly spaced buttons.
*   **2.3.0**
    *   **UX Improvement:** Optimized dialog panels for a better mobile experience. Panels are now full-screen on smaller devices with a more touch-friendly layout.
    *   **Tech:** Added a viewport meta tag to ensure proper scaling on mobile browsers.
*   **2.2.1**
    *   **UX Improvement:** Dialog panels now automatically close when another is opened, preventing UI overlap.
    *   **UI Polish:** Moved the "Watching History" panel's header buttons closer to the title for a more compact look.
    *   **UI Polish:** Changed the delete icon color in the history list to off-white for better visibility against the red background.
*   **2.2.0**
    *   **Feature:** Enhanced the "Configure Sync" panel with descriptive text, placeholders, and a "Test Connection" button.
    *   **UX Polish:** Added loading indicators and disabled states for buttons during asynchronous operations.
    *   **Bug Fix:** Resolved a race condition that could cause runtime errors on initialization.
    *   **Bug Fix:** Fixed a fatal syntax error that prevented the script from loading.
*   **2.1.0**
    *   **Feature:** Added search, sort, and bulk-delete functionality to the "Watching History" panel.
*   **2.0.0**
    *   **Feature:** Initial release with core functionality for saving/restoring video progress and Firebase sync.
