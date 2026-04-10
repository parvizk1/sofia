DECISION #1 — Per-client config storage format
Status: RESOLVED — Option 3 (Markdown + YAML for client config, SQLite for leads/logs)

Context: Each Sofia client (the business owner) needs a configuration record holding business name, address, phone, services, hours, calendar ID, greeting script, language preference, and slot rules. Parviz wants "something an LLM can talk to and easy to use." This choice shapes how Claude reads client context during calls, how Parviz onboards new clients, and how the system scales from 3 to 30+ clients.

Options:
  1. JSON files on disk — One `clients/{slug}.json` per client, loaded into Claude's system prompt at call start. Edit with any text editor or future admin UI. Git-versioned. | Tradeoff: No query capability, manual file management, but dead simple and zero infrastructure. Claude reads JSON natively. Scales fine to ~50 clients.

  2. SQLite database — Single `sofia.db` file with `clients`, `leads`, `calls` tables. Node reads config at call start, injects into prompt. Leads and call logs get proper relational storage. | Tradeoff: Adds a query layer (good for lead reports and analytics), slightly more setup, but still zero-infrastructure (single file). Claude doesn't read SQL directly — you'd serialize to JSON for the prompt anyway.

  3. Markdown files with YAML frontmatter — One `clients/{slug}.md` per client. YAML frontmatter for structured fields (hours, services, slot config), markdown body for greeting script and free-form instructions. LLM-native format. | Tradeoff: Most natural format for an LLM to consume directly. Easy to edit. But leads/call-logs still need a separate store (SQLite or JSON). Hybrid approach.

Architect recommendation: Option 3 (Markdown + YAML frontmatter) for client config, paired with SQLite for leads/call-logs.

Rationale: Client config changes rarely and benefits from being human-readable and LLM-friendly — markdown is the most natural format for both. Leads and call logs are write-heavy transactional data that benefit from SQL queries ("show me all leads from this week", "how many calls did client X get?"). This hybrid gives you the best of both: easy client onboarding (edit a markdown file), proper data storage for the CRM-like features (SQLite), and zero external infrastructure. When you eventually build an admin dashboard, SQLite queries power it trivially.

Your call (reply with a number):
