import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, async (_req: Request, res: Response) => {
  res.json({
    leagues: [
      { id: 'pl', name: 'Premier League', country: 'England', logo: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
      { id: 'laliga', name: 'La Liga', country: 'Spain', logo: '🇪🇸' },
      { id: 'sa', name: 'Serie A', country: 'Italy', logo: '🇮🇹' },
      { id: 'bl', name: 'Bundesliga', country: 'Germany', logo: '🇩🇪' },
      { id: 'ligue1', name: 'Ligue 1', country: 'France', logo: '🇫🇷' },
      { id: 'ucl', name: 'Champions League', country: 'Europe', logo: '🇪🇺' },
    ],
  })
})

export default router
