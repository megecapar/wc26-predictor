export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  points: number
  created_at: string
}

export interface Badge {
  id: number
  key: string
  name: string
  description: string
  icon: string
}

export interface UserBadge {
  user_id: string
  badge_id: number
  earned_at: string
  badges?: Badge
}

export interface Coupon {
  id: string
  user_id: string
  title: string | null
  total_odd: number
  status: 'pending' | 'won' | 'lost'
  points_won: number
  created_at: string
  profiles?: Profile
  coupon_bets?: CouponBet[]
}

export interface CouponBet {
  id: number
  coupon_id: string
  match_id: string
  match_label: string
  market_key: string
  market_label: string
  odd: number
  result: 'pending' | 'won' | 'lost'
}

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}
