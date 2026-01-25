# Examensradar

**Dein Examen ist durch. Wir sagen dir, wann die Noten da sind.**

Push notifications for exam results from German judicial examination offices (Justizprüfungsämter).

## Features

- Subscribe to notifications for any JPA (Justizprüfungsamt)
- Push notifications via [ntfy](https://ntfy.sh) to all your devices
- No app installation required - works with the ntfy app or in the browser
- Admin dashboard for managing JPAs with webhook documentation

## Tech Stack

- **Frontend**: React 19 + TanStack Start
- **API**: tRPC + React Query
- **Database**: Bun SQLite + Drizzle ORM
- **Auth**: Better Auth with Google OAuth
- **Styling**: Tailwind CSS v4 (Neobrutalism theme)
- **Runtime**: Bun
- **Deployment**: Railpack + Dokploy

## Getting Started

### Prerequisites

- Bun (via mise: `mise install`)

### Installation

```bash
bun install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Generate secrets:
```bash
# Generate Better Auth secret
bunx @better-auth/cli secret

# Generate webhook secret (or use any random string)
openssl rand -hex 32
```

### Database Setup

```bash
# Generate migrations
bun run db:generate

# Apply migrations
bun run db:migrate

# Seed database
bun run db:seed
```

### Development

```bash
bun run dev
```

Visit http://localhost:3000

## Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run check` - Lint and format code
- `bun run db:generate` - Generate database migrations
- `bun run db:migrate` - Apply migrations
- `bun run db:seed` - Seed database
- `bun run db:studio` - Open Drizzle Studio

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
