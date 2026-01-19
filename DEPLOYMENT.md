# Production Deployment Checklist

## Pre-Deployment

### 1. Environment Setup
- [ ] Create `.env.local` from `.env.example` for local development
- [ ] Generate `BETTER_AUTH_SECRET`: `npx @better-auth/cli secret`
- [ ] Generate `WEBHOOK_SECRET`: `openssl rand -hex 32`
- [ ] Set up Google OAuth credentials at https://console.cloud.google.com/apis/credentials

### 2. Google OAuth Configuration
- [ ] Create OAuth 2.0 Client ID
- [ ] Add authorized redirect URI: `https://your-domain.workers.dev/api/auth/callback/google`
- [ ] Copy Client ID and Client Secret

### 3. Cloudflare Setup
- [ ] Create D1 database: `wrangler d1 create examensradar-db`
- [ ] Update `database_id` in `wrangler.toml`
- [ ] Run migrations: `npm run db:migrate:remote`
- [ ] Seed database: `npm run db:seed:remote`

### 4. Set Production Secrets
```bash
# Required secrets
wrangler secret put BETTER_AUTH_SECRET
# Enter your generated secret

wrangler secret put BETTER_AUTH_URL
# Enter your production URL, e.g., https://examensradar.workers.dev

wrangler secret put GOOGLE_CLIENT_ID
# Enter your Google OAuth Client ID

wrangler secret put GOOGLE_CLIENT_SECRET
# Enter your Google OAuth Client Secret

wrangler secret put WEBHOOK_SECRET
# Enter your webhook secret
```

### 5. Security Verification
- [ ] No secrets in source code (check with `git grep -i secret`)
- [ ] `.env.local` is in `.gitignore`
- [ ] All environment variables validated at runtime
- [ ] Google OAuth redirect URIs match production domain

## Deployment

### Build and Deploy
```bash
# Build the application
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

### Verify Deployment
```bash
# Test authentication
curl https://your-domain.workers.dev/api/auth/session

# Test tRPC endpoints
curl https://your-domain.workers.dev/api/trpc/jpa.getAll
```

## Post-Deployment

### 1. Verify Core Features
- [ ] Homepage loads correctly
- [ ] Google OAuth login works
- [ ] Dashboard shows JPAs
- [ ] Subscribe/unsubscribe functionality works
- [ ] ntfy topic is generated for subscriptions

### 2. Test Webhook
```bash
curl -X POST https://your-domain.workers.dev/api/webhook/results \
  -H "Authorization: Bearer your-webhook-secret" \
  -H "Content-Type: application/json" \
  -d '{"jpa_slug": "test-jpa"}'
```

### 3. Monitor
- [ ] Check Cloudflare Workers logs
- [ ] Monitor error rates
- [ ] Verify database queries are working
- [ ] Test notification delivery

## Updating Secrets

To rotate secrets in production:
```bash
# Generate new secret
npx @better-auth/cli secret

# Update in Cloudflare
wrangler secret put BETTER_AUTH_SECRET

# For zero-downtime rotation, update Better Auth to support multiple secrets
```

## Rollback Plan

If issues occur:
```bash
# Deploy previous version
git checkout <previous-commit>
npm run build
npm run deploy

# Or use Cloudflare's rollback feature in the dashboard
```

## Domain Setup (Optional)

### Custom Domain
1. Add custom domain in Cloudflare Workers dashboard
2. Update `BETTER_AUTH_URL` secret to use custom domain
3. Update Google OAuth authorized redirect URIs

### DNS Configuration
- Add CNAME record pointing to `<worker-name>.workers.dev`
- Enable Cloudflare proxy (orange cloud)

## Monitoring and Maintenance

### Regular Tasks
- Review Cloudflare Workers analytics weekly
- Check error logs for security issues
- Update dependencies monthly: `npm update`
- Rotate secrets quarterly

### Performance
- Monitor D1 query performance
- Check ntfy.sh notification delivery rates
- Review subscription counts and growth

## Troubleshooting

### Common Issues

**Auth not working:**
- Verify `BETTER_AUTH_URL` matches your domain
- Check Google OAuth redirect URIs
- Verify all auth secrets are set

**Webhook fails:**
- Verify `WEBHOOK_SECRET` matches external scraper
- Check Authorization header format: `Bearer <secret>`
- Review Cloudflare Workers logs

**Database errors:**
- Verify D1 binding in `wrangler.toml`
- Check migrations were applied: `wrangler d1 migrations list examensradar-db`
- Verify database_id is correct

## Security Incident Response

If secrets are exposed:
1. Immediately rotate all affected secrets
2. Review access logs in Cloudflare dashboard
3. Update Google OAuth credentials if needed
4. Check for unauthorized database access
5. Document incident in SECURITY.md
