#!/bin/bash
set -e

echo "=== Liora Stripe Webhook Integration Test Helper ==="
echo ""
echo "This script documents the exact steps to build + run a real end-to-end test"
echo "of the new Stripe billing integration (colocated inside nest-core billing)."
echo ""

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Prerequisites:"
echo "  - Stripe CLI installed (https://stripe.com/docs/stripe-cli)"
echo "  - You have run 'stripe login' at least once"
echo "  - Real Stripe test keys (from https://dashboard.stripe.com/test/apikeys)"
echo ""

echo "Step 0: Put these in your root .env (replace the placeholders):"
echo "  STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
echo "  STRIPE_WEBHOOK_SECRET=${STRIPE_SECRET_KEY}
echo ""

echo "Step 1: Build nest-core (contains the new billing/stripe code):"
echo "  pnpm nx build nest-core --skip-nx-cache"
echo ""

echo "Step 2: Start the admin backend in one terminal (port 7001):"
echo "  pnpm nx serve nest-admin-backend"
echo ""
echo "  The webhook will be available at: http://localhost:7001/api/webhooks/stripe"
echo ""

echo "Step 3: In a second terminal, start the Stripe event forwarder:"
echo "  stripe listen --forward-to http://localhost:7001/api/webhooks/stripe"
echo ""
echo "  It will print something like:"
echo "    > Ready! Your webhook signing secret is whsec_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
echo ""
echo "  Copy that whsec_... value into STRIPE_WEBHOOK_SECRET in .env"
echo "  Then restart the serve command from Step 2."
echo ""

echo "Step 4: Trigger real webhook events (run these while 'stripe listen' is active):"
echo "  stripe trigger checkout.session.completed"
echo "  stripe trigger invoice.paid"
echo "  stripe trigger customer.subscription.created"
echo "  stripe trigger customer.subscription.updated"
echo "  stripe trigger customer.subscription.deleted"
echo ""

echo "Expected result:"
echo "  In the nest-admin-backend terminal you should see logs from BillingWebhookHandlers:"
echo "    - Received webhook event: ..."
echo "    - Checkout completed for org ..."
echo "    - etc."
echo ""
echo "If you see those logs, the full integration (StripeModule + declarative webhooks + raw body + @Public guard bypass) is working."
echo ""
echo "Route tested: /api/webhooks/stripe"
echo "Implementation location: libs/nest-core/src/modules/billing/stripe/"
echo ""

# If the user runs this script with --serve it will try to start the server
# (this only works if their current shell has node + pnpm in PATH)
if [[ "${1:-}" == "--serve" ]]; then
  echo ">>> Starting serve now (Ctrl+C to stop)..."
  pnpm nx serve nest-admin-backend
fi
