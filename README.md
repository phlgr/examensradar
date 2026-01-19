# Examensradar

Push-Benachrichtigungen für Examensergebnisse deutscher Justizprüfungsämter.

## Tech Stack

- **Frontend**: React 19 + TanStack Router
- **API**: tRPC + React Query
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Auth**: Better Auth with Google OAuth
- **Styling**: Tailwind CSS v4 (Neobrutalism theme)
- **Deployment**: Cloudflare Workers/Pages

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account (for production deployment)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
# Better Auth
BETTER_AUTH_SECRET=your-secret-here  # Generate with: npx @better-auth/cli secret
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Webhooks
WEBHOOK_SECRET=your-webhook-secret

# Optional
NTFY_BASE_URL=https://ntfy.sh
```

### Database Setup

```bash
# Generate migrations
npm run db:generate

# Apply migrations locally
npm run db:migrate:local

# Seed database
npm run db:seed:local
```

### Development

```bash
npm run dev
```

Visit http://localhost:3000

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Lint and format code
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate:local` - Apply migrations locally
- `npm run db:migrate:remote` - Apply migrations to production
- `npm run deploy` - Deploy to Cloudflare

## Project Structure

```
src/
├── components/        # React components
├── db/               # Database schema and queries (Drizzle)
├── lib/              # Utilities (auth, tRPC, etc.)
├── routes/           # File-based routing
├── server/           # tRPC routers and procedures
└── styles.css        # Global styles
```

## Documentation

- `DATABASE_SETUP.md` - Database architecture and patterns

## License

Private
