# Session Notifier

Session Notifier is organized as a local TypeScript service with a separate native mobile app area.

## Repository layout

- [`service/`](service/): Node.js/TypeScript session observation service.
- [`app/android/`](app/android/): native Kotlin Android project scaffold. Notification functionality is not implemented yet.
- [`docs/`](docs/): architecture, operations, source, and implementation documentation.

## Service quick start

```powershell
Set-Location .\service
npm install
npm start
```

Service checks can be run from `service/` with `npm run build` and `npm test`.

## Android client

Open [`app/android/`](app/android/) in Android Studio when beginning Android client work. The current project is only a native project boundary and placeholder activity; it does not connect to the service or implement notifications.

See [`docs/README.md`](docs/README.md) for the service documentation index.
