# Flash Accounting

A modern, beautiful React Native expense tracking app built with Expo. Track your income and expenses with an intuitive interface featuring glass morphism design, dark mode support, and multi-language localization.

## ✨ Features

- **Quick Expense Tracking**: Add expenses and income with a single tap
- **Voice Input**: Dictate expense descriptions using speech recognition
- **Statistics Dashboard**: View your spending patterns with day/month views
- **Multi-language Support**: Available in English, Traditional Chinese, Spanish, French, German, and Japanese
- **Dark Mode**: Automatic theme switching based on system preferences
- **Modern UI**: Glass morphism design with smooth animations
- **Offline First**: All data stored locally using SQLite
- **Export Data**: Export your data to CSV format

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for Mac) or Android Emulator
- For physical devices: Expo Go app

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flash-accounting
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on your device**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## 📱 Building for Production

### iOS

```bash
# Build for iOS
eas build --platform ios --profile production
```

### Android

```bash
# Build for Android
eas build --platform android --profile production
```

## 🏗️ Project Structure

```
flash-accounting/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout with providers
│   └── index.tsx          # Main screen
├── components/            # React components
│   ├── ConsumptionForm.tsx
│   ├── ConsumptionItem.tsx
│   ├── ErrorBoundary.tsx
│   ├── FeaturesCarousel.tsx
│   ├── GlassContainer.tsx
│   ├── GlassTabBar.tsx
│   ├── SettingsModal.tsx
│   └── StatisticsView.tsx
├── contexts/              # React Context providers
│   ├── LanguageContext.tsx
│   └── ThemeContext.tsx
├── hooks/                 # Custom React hooks
│   ├── useConsumptionStats.ts
│   ├── useConsumptionStorage.ts
│   └── useSpeechRecognition.ts
├── types/                 # TypeScript type definitions
│   └── consumption.ts
├── utils/                 # Utility functions
│   ├── constants.ts
│   ├── db.ts
│   ├── db-schema.ts
│   ├── debounce.ts
│   ├── feature-carousel.ts
│   ├── features.ts
│   ├── formatting.ts
│   └── validation.ts
└── assets/                # Images, icons, fonts
```

## 🛠️ Technology Stack

- **Framework**: React Native 0.81.5 with Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **Database**: SQLite (expo-sqlite)
- **Animations**: React Native Reanimated 4
- **State Management**: React Context API + Custom Hooks
- **Styling**: StyleSheet with dynamic theming
- **Type Safety**: TypeScript with strict mode
- **Architecture**: New Architecture enabled (React Native 0.81+)

## 📚 Key Components

### ErrorBoundary
Catches React errors and displays user-friendly error messages. Prevents the entire app from crashing.

### ConsumptionForm
Form component for adding expenses/income with:
- Real-time validation
- Voice input support
- Amount formatting with thousand separators
- Error message display

### StatisticsView
Comprehensive statistics dashboard with:
- Day/month view modes
- Time filters (today, week, month, year, all)
- Sort options (date, amount)
- Pagination for large datasets
- Optimized SQL queries

### Database Layer
- **db.ts**: Database connection and query utilities
- **db-schema.ts**: Schema initialization and migrations
- **useConsumptionStorage.ts**: Hook for consumption CRUD operations
- **useConsumptionStats.ts**: Hook for optimized statistics queries

## 🔒 Data Validation

All user inputs are validated before saving:

- **Amount**: Must be > 0, max 999,999,999.99, max 2 decimal places
- **Description**: Max 500 characters, optional
- **Type**: Must be 'expense' or 'income'

See `utils/validation.ts` for validation logic.

## 🌍 Internationalization

The app supports 6 languages:
- English (en)
- Traditional Chinese (zh)
- Spanish (es)
- French (fr)
- German (de)
- Japanese (ja)

Language is automatically detected from device settings, or can be manually selected in settings.

## 🎨 Theming

The app supports automatic dark/light mode based on system preferences:
- Light theme: White background, black text
- Dark theme: Black background, white text
- Glass morphism effects adapt to theme

## ⚡ Performance Optimizations

- **Pagination**: Large lists are paginated (5 items per page)
- **Memoization**: Components and callbacks are memoized
- **SQL Optimization**: Indexed queries, efficient aggregations
- **FlatList Optimization**: `getItemLayout`, `removeClippedSubviews`, `windowSize`
- **Debouncing**: Input handlers are debounced where appropriate
- **Lazy Loading**: Data loaded only when needed

## 🧪 Development

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Expo ESLint config
- **Error Boundaries**: Comprehensive error handling
- **Validation**: Input validation on all user inputs

### Best Practices

- ✅ Error boundaries for React errors
- ✅ Input validation before database operations
- ✅ User-friendly error messages
- ✅ Optimistic UI updates
- ✅ Proper cleanup in useEffect hooks
- ✅ Memoization for expensive operations
- ✅ Type-safe database queries

## 📝 Scripts

```bash
npm start          # Start Expo development server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on web
npm run lint       # Run ESLint
npm run build:ios:prod       # EAS iOS production build
npm run build:android:prod   # EAS Android production build
npm run submit:ios:prod      # EAS iOS submit
npm run submit:android:prod  # EAS Android submit
```

## 🔐 Auth + Cloud Sync (Pro)

This app is **local-first** by default (SQLite). Users are not forced to log in.

- Sign-in options belong **only in Settings**. See `docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md` for the exact current provider status in this build.
- Cloud sync is gated behind **Pro (IAP)**. Auth alone does not unlock cloud saving.
- When **signed in + Pro**, records sync through **Firestore** and the app refreshes its local cache from cloud.

Setup docs:
- `docs/FIREBASE.md`
- `docs/IAP.md`
- `docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md`

## 🐛 Troubleshooting

### Database Issues
If you encounter database errors:
1. Clear app data and reinstall
2. Check that migrations ran successfully
3. Verify database file permissions

### Build Issues
- Ensure you have the latest Expo CLI
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Expo cache: `expo start -c`

## 📄 License

Private project - All rights reserved

## 👥 Contributing

This is a private project. For questions or issues, please contact the maintainer.

## 🔮 Future Enhancements

- Cloud backup and sync
- Receipt scanning with OCR
- PDF and spreadsheet export templates
- Biometric authentication
- Category management
- Recurring expenses
- Budget tracking

---

Built with ❤️ using React Native and Expo
