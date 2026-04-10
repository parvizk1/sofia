#!/usr/bin/env bash
# Sofia AI — Agent System Setup
# Run once to initialize all agent memory directories, project structure,
# and display usage instructions.

set -euo pipefail

SOFIA_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$SOFIA_ROOT"

echo "=================================="
echo "  Sofia AI — Agent System Setup"
echo "=================================="
echo ""

# ── 1. Agent memory directories ──────────────────────────────────────────────

AGENTS=(architect designer principal-engineer coder critic devils-advocate note-taker secretary)

echo "[1/4] Creating agent memory directories..."
for agent in "${AGENTS[@]}"; do
  dir=".claude/agent-memory/${agent}"
  mkdir -p "$dir"
  if [ ! -f "$dir/MEMORY.md" ]; then
    echo "# ${agent} — Agent Memory Index" > "$dir/MEMORY.md"
    echo "       Created: $dir/MEMORY.md"
  else
    echo "       Exists:  $dir/MEMORY.md"
  fi
done
echo ""

# ── 2. Project directories ───────────────────────────────────────────────────

echo "[2/4] Creating project directories..."
for d in specs docs/notes docs/decisions; do
  mkdir -p "$d"
  echo "       $d/"
done
echo ""

# ── 3. .env.example ──────────────────────────────────────────────────────────

echo "[3/4] Checking .env.example..."
if [ ! -f .env.example ]; then
  cat > .env.example << 'ENVEOF'
# Sofia AI — Environment Variables
# Copy to .env and fill in real values. Never commit .env.

# Twilio (telephony + SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# OpenAI Whisper (speech-to-text)
OPENAI_API_KEY=

# Anthropic Claude (AI brain)
ANTHROPIC_API_KEY=

# ElevenLabs (text-to-speech)
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
ENVEOF
  echo "       Created .env.example"
else
  echo "       .env.example already exists"
fi
echo ""

# ── 4. .gitignore check ──────────────────────────────────────────────────────

echo "[4/4] Checking .gitignore..."
NEED_ENTRIES=()
for pattern in ".env" "node_modules/" ".claude/agent-memory/"; do
  if ! grep -qxF "$pattern" .gitignore 2>/dev/null; then
    NEED_ENTRIES+=("$pattern")
  fi
done

if [ ${#NEED_ENTRIES[@]} -gt 0 ]; then
  for entry in "${NEED_ENTRIES[@]}"; do
    echo "$entry" >> .gitignore
    echo "       Added to .gitignore: $entry"
  done
else
  echo "       .gitignore is good"
fi

echo ""
echo "=================================="
echo "  Setup complete!"
echo "=================================="
echo ""
echo "Agent memory directories are at: .claude/agent-memory/<agent>/"
echo ""
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│  HOW TO USE AGENTS                                              │"
echo "│                                                                 │"
echo "│  In Claude Code, type:  /agent <name>                          │"
echo "│                                                                 │"
echo "│  Available agents:                                              │"
echo "│                                                                 │"
echo "│  /agent secretary          Start or end a session               │"
echo "│  /agent architect          New feature / direction / blueprint  │"
echo "│  /agent devils-advocate    Challenge a decision before commit   │"
echo "│  /agent designer           Write a spec from a blueprint        │"
echo "│  /agent principal-engineer Review spec or coder output          │"
echo "│  /agent coder              Build from an approved spec          │"
echo "│  /agent critic             Review code quality + reliability    │"
echo "│  /agent note-taker         Capture session notes + decisions    │"
echo "│                                                                 │"
echo "│  TYPICAL WORKFLOW ORDER:                                        │"
echo "│                                                                 │"
echo "│  1. /agent secretary          (open session)                    │"
echo "│  2. /agent architect          (blueprint)                       │"
echo "│  3. /agent devils-advocate    (stress-test direction)           │"
echo "│  4. /agent designer           (write spec)                      │"
echo "│  5. /agent principal-engineer (review spec)                     │"
echo "│  6. /agent coder              (build it)                        │"
echo "│  7. /agent critic             (review output)                   │"
echo "│  8. /agent principal-engineer (final sign-off)                  │"
echo "│  9. /agent note-taker         (capture session)                 │"
echo "│ 10. /agent secretary          (close session)                   │"
echo "│                                                                 │"
echo "└──────────────────────────────────────────────────────────────────┘"
echo ""
