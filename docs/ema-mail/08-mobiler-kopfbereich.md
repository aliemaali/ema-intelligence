# Korrektur des mobilen Kopfbereichs

14.11.2026: Der Nutzer zeigt einen iPhone-Home-Screen-Screenshot mit gedrängtem Logo/Suchfeld und einer dunklen Systemfläche über der hellen Mail-Oberfläche.

- Mobiler Kopfbereich bis 650px zweizeilig: Logo und Themenumschalter oben, vollständiges Suchfeld darunter. 16px oberer Innenabstand, 16px Suchschrift gegen Fokuszoom. Keine Verkleinerung oder Verzerrung des Logos. Navigation am tatsächlichen Inhaltsbereich verankert, statt mit hartem Header-Offset.
- Die Mail-Route setzt eine eigene temporäre Dokument-Farbkennung bereits vor Hydration und als Effekt. ThemeRuntime berücksichtigt diese Kennung für color-scheme und theme-color auch nach Fokus/Seitenwechsel. HTML und Body erhalten dieselbe Hintergrundfarbe wie EMA Mail. Beim Verlassen der Mail-Route wird die Kennung entfernt und das gespeicherte Plattformdesign wieder angewendet. Keine Änderung an der gespeicherten Plattformpräferenz.
- Statusleistenstil bleibt default, kein black-translucent. Mail hat eigene initiale Viewport-Farbmetadaten. Die Systemfläche einer installierten PWA und iOS-eigene Unschärfe können nicht vollständig in einer Desktop-Vorschau nachgebildet oder vom Web-Code kontrolliert werden.

Primärquelle zur aktuellen iOS-Grenze: https://bugs.webkit.org/show_bug.cgi?id=317153 und https://bugs.webkit.org/show_bug.cgi?id=301994. Kein Versprechen, einen iOS-Compositor-Effekt vollständig abzustellen; echte Geräteprüfung bleibt erforderlich.

Prüfung: bestehende Mail-/PWA-Tests, TypeScript und ESLint; mobile Browserprüfung von Zeilenposition, Suche, Überlauf, Farbwechsel sowie Rückkehr zum Plattformdesign. Hintergrunddienste und deren Freigabe-/Senderegeln werden nicht geändert.
