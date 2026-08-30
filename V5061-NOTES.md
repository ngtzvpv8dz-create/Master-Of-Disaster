# V506.1 Backup Hotfix

- Vollbackup: globaler Capture-Handler fängt den alten V397/V498-Klick ab, damit kein automatischer Blob-Download mehr die iPhone-PWA verlassen kann.
- Fertige ZIP: erst nach explizitem zweiten Tipp über Share-Sheet; manueller Download nur als sichtbarer Fallback.
- Wochen-Cloudbackup: speichert Bundle Version 2 mit wiederherstellbarem App-Stand, aber ohne die komplette lokale 7-Tage-Historie und ohne den Live-Log in derselben JSON-Zeile.
- Bestehende alte Wochenstände bleiben über den V506.1-Listener wiederherstellbar.
- V498 bleibt das Sicherheitsmodul und der IndexedDB-Reconnect aus V506 bleibt erhalten.
