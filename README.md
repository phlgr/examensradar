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

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Generate secrets:
```bash
# Generate Better Auth secret
npx @better-auth/cli secret

# Generate webhook secret (or use any random string)
openssl rand -hex 32
```

For production deployment to Cloudflare, set secrets using:
```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put WEBHOOK_SECRET
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

## License

Private
