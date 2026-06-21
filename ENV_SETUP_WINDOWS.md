# .env.local unter Windows anlegen – Schritt für Schritt

## Das Problem

Die Fehlermeldung
```
Your project's URL and Key are required to create a Supabase client
```
bedeutet: Next.js findet die Datei `.env.local` nicht oder sie ist leer.
`.env.local` enthält geheime Zugangsdaten und wird **nicht mitgeliefert**
(steht bewusst in `.gitignore`) – sie muss lokal von dir angelegt werden.

---

## Schritt 1 – Werte aus Supabase holen

1. Gehe zu **https://supabase.com/dashboard**
2. Öffne dein Projekt `ema-intelligence`
3. Links im Menü: **Settings** (Zahnrad-Symbol) → **API**
4. Du siehst dort zwei Werte, die du brauchst:

| Feld im Supabase Dashboard | Beispielwert | Wird zu |
|---|---|---|
| **Project URL** | `https://abcdefghijk.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **Project API keys → anon / public** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (langer String) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

⚠️ Verwende den **`anon` / `public`** Key – **nicht** den `service_role` Key
(der ist geheim und gehört niemals in den Frontend-Code).

---

## Schritt 2 – Datei unter Windows anlegen

### Option A: Mit dem Datei-Explorer (einfachster Weg)

Windows blockiert standardmäßig das Erstellen von Dateien, die nur mit
einem Punkt beginnen (`.env.local`). So umgehst du das:

1. Öffne den Projektordner `ema-intelligence-export` im Explorer
2. Rechtsklick → **Neu → Textdokument**
3. Die Datei heißt zunächst `Neue Textdatei.txt`
4. Datei umbenennen zu genau: `.env.local.` **(mit einem Punkt am Ende!)**
   → Windows entfernt den letzten Punkt automatisch, übrig bleibt `.env.local`
5. Falls eine Warnung erscheint ("Wenn Sie die Dateinamenerweiterung ändern…") → mit **Ja** bestätigen

> **Wichtig:** Falls du die Dateiendungen nicht siehst (`.txt` ist unsichtbar):
> Explorer → Ansicht (oben) → Häkchen bei **"Dateinamenerweiterungen"** setzen

### Option B: Mit VS Code (empfohlen, wenn installiert)

1. Projektordner in VS Code öffnen (`Datei → Ordner öffnen`)
2. Rechtsklick im Datei-Explorer links → **Neue Datei**
3. Namen eingeben: `.env.local` → Enter
4. VS Code akzeptiert den führenden Punkt ohne Probleme

### Option C: Mit der Kommandozeile (PowerShell)

```powershell
cd Pfad\zu\ema-intelligence-export
copy .env.example .env.local
```
Das kopiert die Vorlage direkt unter dem richtigen Namen.

### Option D: Mit der Kommandozeile (CMD)

```cmd
cd Pfad\zu\ema-intelligence-export
copy .env.example .env.local
```

---

## Schritt 3 – Datei befüllen

Öffne `.env.local` mit einem Texteditor (Notepad, VS Code, etc.)
und trage deine **echten** Supabase-Werte ein:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...langer-string...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=EMA Intelligence
```

**Regeln:**
- Keine Anführungszeichen um die Werte
- Keine Leerzeichen vor/nach dem `=`
- Eine Zeile pro Variable
- Datei muss im **Projekt-Root** liegen (gleiche Ebene wie `package.json`)

---

## Schritt 4 – Speicherort prüfen

Die Datei muss **exakt hier** liegen:

```
ema-intelligence-export/
├── .env.local          ← HIER, gleiche Ebene wie package.json
├── package.json
├── next.config.js
├── src/
└── ...
```

**Nicht** in `src/`, **nicht** in einem Unterordner.

### Prüfen via PowerShell:
```powershell
cd Pfad\zu\ema-intelligence-export
dir /a .env.local
```
Wenn die Datei existiert, wird sie angezeigt. Mit `dir` (ohne `/a`) bleibt sie
manchmal unsichtbar, da Windows versteckte/Punkt-Dateien anders behandelt.

---

## Schritt 5 – Server neu starten

Next.js liest Environment-Variablen **nur beim Start** ein.
Nach jeder Änderung an `.env.local`:

```powershell
# Falls der Server noch läuft: Strg + C zum Beenden
npm run dev
```

---

## Häufige Stolperfallen unter Windows

| Problem | Lösung |
|---|---|
| Datei heißt `.env.local.txt` | Dateinamenerweiterungen im Explorer einblenden, `.txt` entfernen |
| Werte in Anführungszeichen kopiert | Keine `"` oder `'` um die Werte setzen |
| Datei liegt in falschem Ordner | Muss neben `package.json` liegen, nicht in `src/` |
| Server lief noch beim Speichern | Server neu starten (Strg+C, dann `npm run dev`) |
| Zeilenumbrüche durch Windows (CRLF) | Normalerweise unproblematisch, bei Fehlern: Datei in VS Code mit "LF" statt "CRLF" speichern (unten rechts in der Statusleiste) |
| Falscher Key kopiert (`service_role` statt `anon`) | Im Supabase Dashboard nochmal genau den **anon / public** Key prüfen |

---

## Schnelltest, ob es funktioniert hat

Nach `npm run dev` sollte in der Konsole **kein** Fehler zu
"Supabase URL and Key" mehr erscheinen. Browser-Aufruf von
`http://localhost:3000` sollte automatisch auf `/login` umleiten
und das Login-Formular zeigen, ohne Crash.
