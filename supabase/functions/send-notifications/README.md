# send-notifications Edge Function

Sends email alerts for overdue invoices and low-stock products using Resend.

## Deploy

```bash
supabase functions deploy send-notifications
```

## Required Secrets (set in Supabase Dashboard → Edge Functions → Secrets)

| Key | Value |
|-----|-------|
| `RESEND_API_KEY` | Get from resend.com (free tier: 3,000/month) |
| `FROM_EMAIL` | `Nexus-GH <noreply@yourdomain.com>` |

## Set up Cron (run daily at 8am Ghana time = 8am UTC)

In Supabase Dashboard → Database → Extensions → enable `pg_cron`, then run:

```sql
-- Daily overdue invoice scan at 8am UTC
SELECT cron.schedule(
  'mark-overdue-invoices',
  '0 8 * * *',
  $$ SELECT public.mark_overdue_invoices(); $$
);

-- Daily email digest at 8:05am UTC
SELECT cron.schedule(
  'send-email-notifications',
  '5 8 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

## Manual Trigger

Click the mail icon (✉️) in the Notifications bell in the app header.
Or POST directly:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/send-notifications \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"business_id": "your-business-uuid"}'
```
