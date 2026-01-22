import express, { Request, Response } from 'express'
import {
  createStripeConnectAccount,
  handleStripeWebhook,
  createPaymentLink,
  sendPaymentLinkViaWhatsApp,
} from '../payments/stripe'

const router = express.Router()

// Create Stripe Connect account for business
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.body
    const onboardingUrl = await createStripeConnectAccount(businessId)
    res.json({ url: onboardingUrl })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Create payment link for order
router.post('/create-link', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body
    const paymentUrl = await createPaymentLink(orderId)
    res.json({ url: paymentUrl })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Send payment link via WhatsApp
router.post('/send-link', async (req: Request, res: Response) => {
  try {
    const { orderId, customerPhone, businessId } = req.body
    await sendPaymentLinkViaWhatsApp(orderId, customerPhone, businessId)
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Stripe webhook (must be raw body!)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
)

export default router
