# PROJECT_SPEC: CV Optimizer (Professional Edition)

## 1. Vision & Architecture
This project follows a **Screaming Architecture** pattern. The folder structure itself communicates the application's domain and intent rather than just the framework's technical layers. Selected framework is Astro

### Core Architectural Principle: Content/Style Decoupling
The AI **must never** generate CSS. Its sole responsibility is generating **Semantic HTML** (Content). The application then injects pre-defined, hardcoded CSS (Styles) based on user selection.

```mermaid
graph TD
    subgraph Client_Browser [Client-Side Domain]
        A[UI/UX Components] --> B[browser-memory]
        B -->|IndexedDB| C[(State & History Stack)]
        A --> D[style-templates]
    end

    subgraph Core_Logic [Business Logic - Screaming Folders]
        E[llm-processing] -->|Prompts & Parsing| F[AI Bridge]
        G[export-cv] -->|Engines| H[PDF / HTML / TXT]
    end

    subgraph Workflow
        I[Upload Sanitized Doc] --> J[Extract Content]
        J --> E
        E -->|Return Semantic HTML| B
        B -->|Apply CSS Variable| D
        D -->|Render Preview| A
    end

    style C fill:#e1f5fe,stroke:#01579b
    style D fill:#f1f8e9,stroke:#33691e
    style G fill:#fff3e0,stroke:#e65100
```

## 2. Screaming Architecture Folder Structure
The `src/server/` directory is organized by feature and domain:

* `src/server/llm-processing/`: Logic for prompt engineering, document sanitization, and stateless API calls to LLMs.
* `src/styles/cv-templates/`: Hardcoded CSS files and logic for theme switching. Includes the **Color Picker API** integration to override CSS variables.
* `src/server/browser-memory/`: Implementation of IndexedDB persistence and the **Undo/Redo** stack (Memento pattern).
* `src/server/export-cv/`: Logic for converting the final state into `.pdf`, `.html`, and `.txt` (plain text).
* `src/components/`: Reusable interface elements.

## 3. Technical Specifications

### A. Content Management & State
* **Editing:** The generated CV must be rendered in an editable mode (e.g., `contenteditable` or controlled inputs).
* **Undo/Redo:** Every user change or template swap must be pushed to a history stack in `browser-memory` to allow `Ctrl+Z` / `Ctrl+Y` functionality.
* **Theming:** Templates are interchangeable. Changing a template simply swaps the CSS link/object without re-triggering the AI processing.

### B. Export Engines
* **PDF:** Use `window.print()` for the manual "Ctrl+P" route. For automated downloads, use **Puppeteer** (Node.js) on the server-side to ensure high-fidelity rendering of CSS templates.
* **TXT:** A specific parser in `export-cv` must strip all HTML tags and CSS to provide a "clean-text" version for platforms that require manual copy-pasting.
* **HTML:** Export a standalone file with the hardcoded CSS inlined or in a `<style>` block.

### C. Style Control
* **CSS Templates:** Hardcoded in `src/styles/cv-templates`.
* **Dynamic Styling:** Use CSS Variables (e.g., `--primary-color`). The UI must provide a Color-Picker that updates this variable globally in the preview without affecting the content structure.

## 4. Security & Privacy Rules (Review)
* **Input Sanitization:** Before sending data to the AI or saving to IndexedDB, all inputs (PDF, HTML, YAML, TXT) must be stripped of script tags or malicious payloads.
* **UI Copy:** Maintain "Security through Obscurity".
    * *Rule:* Do not mention "IndexedDB" or "Puppeteer" in the UI. 
    * *Messaging:* "Your data is stored locally in this browser. If you switch devices, you must start over."

## 5. Instructions for AI Coding Assistants
* **Component Logic:** When creating the editor, implement a "change tracker" that syncs with `src/server/browser-memory`.
* **Style Logic:** Ensure that switching a template in `src/styles/cv-templates` does not reset the edited content in the state.
* **Export Logic:** The `.txt` export must be strictly plain text, optimized for ATS parsers (no markdown symbols like `**` or `#`).
