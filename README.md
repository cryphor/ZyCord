# ZyLord

ZyLord är en Discord client mod med Docker Compose-liknande installationssystem. ZyLord patchar din befintliga Discord-installation — ingen separat app eller extra fönster.

## Kom igång

### Windows (snabbstart)

1. Dubbelklicka på `zy-lord-installer/install.bat`
2. Kör sedan:
   ```bash
   cd zy-lord-installer
   node index.js up
   ```
3. Öppna Discord som vanligt (via startmenyn, genväg eller `start.bat`)

### Manuell installation

```bash
cd zy-lord-installer
npm install
npm start
```

Du kan också köra kommandon direkt (som Docker Compose):

```bash
node index.js up      # Installera plugins och patcha Discord
node index.js pull    # Uppdatera plugins
node index.js ps      # Visa status
node index.js start   # Starta Discord
node index.js down    # Avinstallera och återställ Discord
```

## Användning

Redigera `zy-lord.yml` för att konfigurera plugins och inställningar. Sätt `settings.discordPath` om Discord inte hittas automatiskt.

Stäng Discord innan du kör `up` — patchningen skrivs till Discords `app.asar`.

### Kommandon

- `up` - Installera plugins och patcha Discord
- `down` - Avinstallera ZyLord och återställ Discord
- `build` - Bygg om plugins
- `ps` - Visa Discord- och pluginstatus
- `pull` - Uppdatera plugins
- `logs` - Visa loggar
- `start` - Starta Discord (efter patchning)

## Struktur

- `zy-lord-installer/` — CLI-installer och Discord-patcher
- `zy-lord-installer/injector/` — Loader som injiceras i Discord
- `zy-lord-installer/plugins/` — Installerade plugins (skapas vid `up`)
