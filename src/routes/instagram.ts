import express, { Request, Response } from 'express'
import { supabase } from '../database/supabase'

const router = express.Router()

// Webhook verification (Instagram requires this)
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// Receive messages
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body

    if (body.object === 'instagram') {
      for (const entry of body.entry) {
        for (const messaging of entry.messaging) {
          const senderId = messaging.sender.id
          const messageText = messaging.message?.text

          if (messageText) {
            // Find business by Instagram ID
            const { data: connection } = await supabase
              .from('instagram_connections')
              .select('business_id')
              .eq('instagram_id', entry.id)
              .single()

            if (connection) {
              // Handle Instagram message (similar to WhatsApp handler)
              // TODO: Implement handleInstagramMessage
            }
          }
        }
      }
      res.sendStatus(200)
    } else {
      res.sendStatus(404)
    }
  } catch (error: any) {
    console.error('Instagram webhook error:', error)
    res.sendStatus(500)
  }
})

// Connect Instagram account
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { businessId, accessToken, instagramId, username } = req.body

    await supabase
      .from('instagram_connections')
      .upsert({
        business_id: businessId,
        instagram_id: instagramId,
        username,
        access_token: accessToken,
        status: 'connected',
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
      })

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get Instagram connection status
router.get('/status/:businessId', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params

    const { data: connection } = await supabase
      .from('instagram_connections')
      .select('*')
      .eq('business_id', businessId)
      .single()

    res.json({
      status: connection?.status || 'disconnected',
      username: connection?.username || null,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
