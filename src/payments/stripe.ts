import Stripe from 'stripe'
import { supabase } from '../database/supabase'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Stripe secret key not configured')
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    })
  : null

// Create payment link for customer
export async function createPaymentLink(orderId: string): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, customers(*), businesses(*)')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error('Order not found')
  }

  // Check if business has Stripe connected
  const { data: paymentSettings } = await supabase
    .from('payment_settings')
    .select('*')
    .eq('business_id', order.business_id)
    .single()

  if (!paymentSettings?.stripe_account_id) {
    throw new Error('Payment gateway not configured')
  }

  // Create Stripe payment session
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: (order.items as any[]).map((item: any) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.product,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      customer_email: (order.customers as any)?.email,
      metadata: {
        order_id: orderId,
        business_id: order.business_id,
        customer_id: order.customer_id,
      },
      success_url: `${process.env.FRONTEND_URL}/payment/success?order_id=${orderId}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?order_id=${orderId}`,
    },
    {
      stripeAccount: paymentSettings.stripe_account_id,
    }
  )

  // Save payment session
  await supabase.from('payment_transactions').insert({
    order_id: orderId,
    business_id: order.business_id,
    stripe_session_id: session.id,
    amount: order.total_amount,
    status: 'pending',
    created_at: new Date().toISOString(),
  })

  return session.url || ''
}

// Send payment link via WhatsApp
export async function sendPaymentLinkViaWhatsApp(
  orderId: string,
  customerPhone: string,
  businessId: string
) {
  const paymentUrl = await createPaymentLink(orderId)

  const message = `شكراً لطلبك! 🎉\n\nيمكنك إتمام الدفع الآن من خلال الرابط التالي:\n${paymentUrl}\n\nطرق الدفع المتاحة:\n💳 Visa / Mastercard\n🍎 Apple Pay\n\nالدفع آمن 100% 🔒`

  const { getClient } = await import('../whatsapp/client')
  const client = getClient(businessId)
  
  if (client) {
    await client.sendMessage(`${customerPhone}@c.us`, message)

    // Save message
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('phone', customerPhone)
      .single()

    if (customer) {
      await supabase.from('messages').insert({
        business_id: businessId,
        customer_id: customer.id,
        customer_phone: customerPhone,
        direction: 'outgoing',
        content: message,
        platform: 'whatsapp',
        is_ai: false,
        timestamp: new Date().toISOString(),
      })
    }
  }
}

// Webhook handler for Stripe events
export async function handleStripeWebhook(req: any, res: any) {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' })
  }

  const sig = req.headers['stripe-signature']
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id

    if (orderId) {
      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          paid_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      // Update payment transaction
      await supabase
        .from('payment_transactions')
        .update({
          status: 'completed',
          stripe_payment_intent_id: session.payment_intent as string,
          completed_at: new Date().toISOString(),
        })
        .eq('stripe_session_id', session.id)

      // Get order details
      const { data: order } = await supabase
        .from('orders')
        .select('*, customers(*)')
        .eq('id', orderId)
        .single()

      if (order) {
        // Send confirmation message
        const { getClient } = await import('../whatsapp/client')
        const client = getClient(order.business_id)
        
        if (client && (order.customers as any)?.phone) {
          const confirmMessage = `تم استلام الدفع بنجاح! ✅\n\nرقم الطلب: ${orderId}\nالمبلغ: ${order.total_amount}\n\nسيتم تجهيز طلبك وشحنه قريباً 📦`
          
          await client.sendMessage(
            `${(order.customers as any).phone}@c.us`,
            confirmMessage
          )
        }
      }
    }
  }

  // Handle failed payment
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id

    if (orderId) {
      await supabase
        .from('payment_transactions')
        .update({ status: 'failed' })
        .eq('stripe_session_id', session.id)
    }
  }

  res.json({ received: true })
}

// Connect Stripe account (for business owner)
export async function createStripeConnectAccount(businessId: string): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('*, users(*)')
    .eq('id', businessId)
    .single()

  if (!business) {
    throw new Error('Business not found')
  }

  const account = await stripe.accounts.create({
    type: 'express',
    email: (business.users as any)?.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
  })

  // Save to database
  await supabase.from('payment_settings').upsert({
    business_id: businessId,
    stripe_account_id: account.id,
    enabled: false,
    updated_at: new Date().toISOString(),
  })

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.FRONTEND_URL}/dashboard/settings?tab=payment`,
    return_url: `${process.env.FRONTEND_URL}/dashboard/settings?tab=payment&success=true`,
    type: 'account_onboarding',
  })

  return accountLink.url
}

// Check if payment is enabled for business
export async function isPaymentEnabled(businessId: string): Promise<boolean> {
  const { data } = await supabase
    .from('payment_settings')
    .select('enabled, stripe_account_id')
    .eq('business_id', businessId)
    .single()

  if (!data?.stripe_account_id || !stripe) {
    return false
  }

  // Verify account with Stripe
  try {
    const account = await stripe.accounts.retrieve(data.stripe_account_id)
    return account.charges_enabled && data.enabled
  } catch {
    return false
  }
}
