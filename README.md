# KaiCash

An Android money tracker for students that a parent can pair with, so they can see spending without borrowing the phone.

Built by [Zaidan Ikram](https://zaidanikram.id) in 2026, as sole designer and developer.

## What it does

- **Two roles.** A child records expenses and savings; a parent links to the child's account and follows along.
- **Parent pairing.** The parent adds a child, and both sides read the same Firestore records, so there is no custom server.
- **Budgets** set by the parent, and **savings goals** on the child's side.
- **A receipt photo on every record**, saved with the record.
- **Sign in** with email and password or Google.

| Child | Parent |
| :-- | :-- |
| Dashboard, add expense, history, savings, settings | Dashboard, add child, budget, analytics, history, settings |

## Stack

React Native 0.85 and Expo SDK 56, TypeScript, Firebase (Auth, Firestore), Zustand, React Navigation, `react-native-chart-kit`.

## Structure

```
src/
  config/       Firebase setup
  navigation/   root, auth, child and parent navigators
  screens/      auth/, child/, parent/
  services/     authService (email + Google), familyService (pairing, records)
  store/        Zustand stores for auth and alerts
  types/        shared types
  utils/        currency formatting (IDR)
```

## Run it

```bash
npm install
cp .env.example .env.local   # fill in your Firebase project values
npx expo run:android         # a dev build; Google Sign-In does not work in Expo Go
```

Firebase values go in `.env.local`, which is not committed.
