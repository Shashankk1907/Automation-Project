# LeadFlow AI — Inbound Lead Automation & Classification System

LeadFlow AI is a lightweight, responsive local dashboard and backend microservice designed to automate the process of capturing, classifying, and drafting response messages for inbound leads.

It reads leads from multiple sources, uses an LLM (Gemini, Claude, or OpenAI) to instantly classify them as **Hot**, **Warm**, or **Cold**, and drafts a personalized 1–2 sentence reply. It stores them in a local SQLite database and serves them on a responsive Next.js dashboard where users can search, filter, copy replies, and mark leads as contacted.

---

## 🏗️ Architecture Sketch

Here is how the components interact:

```text
  ┌────────────────────────────────────────────────────────┐
  │                   Inbound Lead Sources                 │
  │  (Google Sheets, Webhook, Google Form, raw CSV, etc.)  │
  └───────────────────────────┬────────────────────────────┘
                              │
                              │ 1. New row added
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │              n8n Local Automation Flow                 │
  │  (Reads sheet, transforms data, POSTs to /lead)        │
  └───────────────────────────┬────────────────────────────┘
                              │
                              │ 2. HTTP POST /lead
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                 Python FastAPI Backend                 │
  │     - Route /lead receives data                        │
  │     - Calls LLM client for categorization              │
  │     - Writes to SQLite local database (leads.db)       │
  └──────┬────────────────────┬────────────────────▲───────┘
         │                    │                    │
         │ 3. Send Message    │ 4. Return JSON     │ 5. GET /leads (fetch list)
         ▼                    ▼                    │    PATCH /leads/{id} (contacted)
  ┌──────────────┐    ┌──────────────┐             │
  │  Gemini API  │    │ Anthropic/OA │             │
  │ (Preferred)  │    │ Fallback API │             │
  └──────────────┘    └──────────────┘             │
                                                   │
  ┌────────────────────────────────────────────────▼────────┐
  │                 Next.js Dashboard UI                    │
  │  - View leads in an elegant color-coded table          │
  │  - Filter by Hot/Warm/Cold, search content             │
  │  - Copy AI-suggested auto-replies                      │
  │  - Toggle "Mark as Contacted" status                   │
  └─────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### Part 1: Start the Backend (Python FastAPI)

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment, then install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Set your LLM API Key (Optional. If not set, a local rule-based classifier will run):
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key"
   # OR: export ANTHROPIC_API_KEY="your-anthropic-key"
   # OR: export OPENAI_API_KEY="your-openai-key"
   ```
4. Start the FastAPI server (starts on port `8000` by default):
   ```bash
   uvicorn app.main:app --reload
   ```

---

### Part 2: Seed & Sync Data (Ingest Google Sheet)

With the backend server running, run the following command in a new terminal window to seed/sync the database with leads fetched from your live Google Sheet:

```bash
cd backend
source venv/bin/activate
python sync_leads.py
```

---

### Part 3: Start the Frontend (Next.js)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server (starts on port `3000` by default):
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to: `http://localhost:3000`

---

### Part 4: Setup n8n Automation (Optional)

1. Run n8n locally:
   ```bash
   npx n8n start
   ```
2. Open n8n in your browser (`http://localhost:5678`).
3. Click on **Workflows** -> **Import from file** and select [n8n_workflow.json](file:///Users/shashank/project%20swati/workflows/n8n_workflow.json).
4. Configure your Google Sheets credentials and Slack webhook channel, then set the flow to Active.

---

## 🛠️ Libraries & Tools Used

### Python Backend
*   **FastAPI**: Selected for its speed, automatic interactive Swagger UI documentation (`http://localhost:8000/docs`), and standard Pydantic request/response validation.
*   **SQLite** (`sqlite3` standard library): Used for persistent SQL storage without adding external infrastructure or driver overhead.
*   **google-genai**, **anthropic**, **openai**: Supported SDKs to allow plug-and-play LLM execution.
*   **python-dotenv**: For clean local environment variable loading.

### Next.js Frontend
*   **Next.js App Router**: Selected because of its modern server-side component structuring, folder-based routing system, and standard use within your team.
*   **Tailwind CSS**: Enabled clean, responsive UI styling using low-level utility classes, minimizing stylesheet bloat and ensuring quick custom HSL color-scheme rendering.

---

## 💡 Tradeoffs & Future Improvements

1.  **Mock Classifier Fallback**:
    *   *Tradeoff*: API keys are not always set during test checks. We added a fallback keyword-based classifier that handles normal inquiries, greetings, and spams.
    *   *Improvement*: If this were production, we would add model routing tests and validation handlers to catch API outages and log fallback alerts.
2.  **State Management**:
    *   *Tradeoff*: For simplicity, we used React's default component level state.
    *   *Improvement*: As the app grows, we'd use TanStack Query (React Query) for API caching, caching invalidate queries, and handling server updates optimistically.
3.  **Database layer**:
    *   *Tradeoff*: SQLite database is queried directly using custom SQL strings in `database.py`.
    *   *Improvement*: In production, we would implement SQLAlchemy or Prisma with migration files (e.g. Alembic) to safely update structural schemas.
4.  **Error Handling**:
    *   *Tradeoff*: We print API exception messages directly to backend logs and use simple try-catch blocks.
    *   *Improvement*: We would write a standard middleware exception logger, setup standard structured errors, and add Sentry alerts for LLM latency spikes or API token rate limits.
