-- WC26 Predictor — Supabase Schema
-- Supabase Dashboard → SQL Editor → New query → yapıştır → Run

-- Kullanıcı profilleri
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  username    text unique not null,
  avatar_url  text,
  points      integer default 0,
  created_at  timestamptz default now()
);

-- Rozetler
create table public.badges (
  id          serial primary key,
  key         text unique not null,
  name        text not null,
  description text,
  icon        text
);

-- Kullanıcı rozetleri
create table public.user_badges (
  user_id    uuid references public.profiles(id) on delete cascade,
  badge_id   integer references public.badges(id),
  earned_at  timestamptz default now(),
  primary key (user_id, badge_id)
);

-- Kuponlar
create table public.coupons (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  title       text,
  total_odd   numeric(6,2),
  status      text default 'pending',
  points_won  integer default 0,
  created_at  timestamptz default now()
);

-- Kupondaki bahisler
create table public.coupon_bets (
  id           serial primary key,
  coupon_id    uuid references public.coupons(id) on delete cascade,
  match_id     text not null,
  match_label  text not null,
  market_key   text not null,
  market_label text not null,
  odd          numeric(5,2),
  result       text default 'pending'
);

-- Takip sistemi
create table public.follows (
  follower_id  uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (follower_id, following_id)
);

-- RLS
alter table public.profiles    enable row level security;
alter table public.badges      enable row level security;
alter table public.user_badges enable row level security;
alter table public.coupons     enable row level security;
alter table public.coupon_bets enable row level security;
alter table public.follows     enable row level security;

-- Profil politikaları
create policy "Profiles viewable by everyone"  on public.profiles for select using (true);
create policy "Users can insert own profile"   on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"   on public.profiles for update using (auth.uid() = id);

-- Rozet politikaları
create policy "Badges viewable by everyone"      on public.badges      for select using (true);
create policy "User badges viewable by everyone" on public.user_badges for select using (true);

-- Kupon politikaları
create policy "Coupons viewable by everyone"  on public.coupons for select using (true);
create policy "Users can create own coupons"  on public.coupons for insert with check (auth.uid() = user_id);
create policy "Users can update own coupons"  on public.coupons for update using (auth.uid() = user_id);

-- Coupon bets politikaları
create policy "Coupon bets viewable by everyone" on public.coupon_bets for select using (true);
create policy "Users can manage own coupon bets" on public.coupon_bets for insert
  with check (auth.uid() = (select user_id from public.coupons where id = coupon_id));

-- Takip politikaları
create policy "Follows viewable by everyone"    on public.follows for select using (true);
create policy "Users can follow others"         on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow"              on public.follows for delete using (auth.uid() = follower_id);

-- Yeni kullanıcı → otomatik profil
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Varsayılan rozetler
insert into public.badges (key, name, description, icon) values
  ('first_coupon', 'İlk Kupon',     'İlk kuponunu oluşturdun',            '🎯'),
  ('five_wins',    'Beş Galibiyet', '5 kazanan kupon oluşturdun',         '🔥'),
  ('ten_wins',     'On Galibiyet',  '10 kazanan kupon oluşturdun',        '⚡'),
  ('perfect_day',  'Mükemmel Gün',  'Aynı günde tüm kuponlarını kazandın','💯'),
  ('social_star',  'Sosyal Yıldız', '10 takipçiye ulaştın',               '⭐'),
  ('wc_master',    'WC Ustası',     'Turnuva boyunca aktif kaldın',       '🏆'),
  ('analyst',      'Analist',       '20 farklı maça bahis yaptın',        '📊'),
  ('high_roller',  'Yüksek Bahis',  '10+ oranlı kupon kazandın',          '💎');
