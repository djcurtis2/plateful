// Hand-written to match supabase/migrations/0001_init.sql.
// After changing the schema you can regenerate with:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type PointsKind =
  | "post"
  | "vote_cast"
  | "vote_received"
  | "referral_signup"
  | "referral_cook"
  | "streak"
  | "win"
  | "chef_pick"
  | "thriftiest"
  | "top10"
  | "receipt";
export type BadgeId =
  | "first_copycat"
  | "top10"
  | "crowd_favorite"
  | "chef_pick"
  | "thriftiest"
  | "streak_4"
  | "brought_3"
  | "saved_100"
  | "saved_500"
  | "saved_1000"
  | "saved_5000"
  | "saved_10000";

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          display_name: string | null;
          referral_code: string;
          referred_by: string | null;
          plan: "free" | "plus";
          stripe_customer_id: string | null;
          subscription_status: string | null;
          current_period_end: string | null;
          bonus_until: string | null;
          referral_rewards_granted: number;
          public_name: string | null;
          is_admin: boolean;
          feature_me: boolean;
          diets: string[];
          avatar: Json | null;
          gear_seen: string[];
          clubs: string[];
          created_at: string;
        },
        "id" | "referral_code"
      >;
      user_gear: Table<
        {
          id: number;
          user_id: string;
          item_id: string;
          source: "shop" | "grant";
          stripe_session_id: string | null;
          created_at: string;
        },
        "user_id" | "item_id" | "source"
      >;
      recipes: Table<
        {
          id: string;
          slug: string;
          user_id: string | null;
          visitor_id: string | null;
          dish: string;
          restaurant: string | null;
          cuisine: string | null;
          meals: string[];
          out_price: number | null;
          menu_serves: number;
          contains: string[];
          diet_tags: string[];
          variant_of: string | null;
          variant_kind: string | null;
          source: "snap" | "leftovers";
          style: string | null;
          inspired_by: string | null;
          servings: number;
          minutes: number | null;
          difficulty: string | null;
          confidence: number | null;
          why: string | null;
          menu_price: number | null;
          plate_cost: number | null;
          ingredients: Json;
          steps: Json;
          image_path: string | null;
          is_public: boolean;
          created_at: string;
        },
        "slug" | "dish" | "ingredients" | "steps"
      >;
      meal_plans: Table<
        { id: string; user_id: string; settings: Json; recipe_ids: string[]; swapped: string[]; created_at: string; updated_at: string },
        "user_id" | "settings"
      >;
      cook_log: Table<
        {
          id: number;
          user_id: string;
          recipe_id: string;
          servings: number;
          home_cost: number;
          out_cost: number;
          saved: number;
          compare: "menu" | "similar" | "average";
          source: "made_it" | "plan" | "cookoff";
          verified: boolean;
          cooked_on: string;
          created_at: string;
        },
        "user_id" | "recipe_id" | "servings" | "home_cost" | "out_cost" | "saved" | "compare" | "source"
      >;
      saved_recipes: Table<
        { user_id: string; recipe_id: string; cooked_at: string | null; created_at: string },
        "user_id" | "recipe_id"
      >;
      pantry_items: Table<{ user_id: string; name: string; created_at: string }, "user_id" | "name">;
      challenges: Table<
        {
          id: string;
          slug: string;
          title: string;
          blurb: string | null;
          recipe_id: string;
          starts_at: string;
          ends_at: string;
          chef_pick_attempt_id: string | null;
          crowd_winner_attempt_id: string | null;
          thriftiest_attempt_id: string | null;
          reference_image_path: string | null;
          finalized_at: string | null;
          created_at: string;
        },
        "slug" | "title" | "recipe_id" | "starts_at" | "ends_at"
      >;
      attempts: Table<
        {
          id: string;
          recipe_id: string;
          challenge_id: string | null;
          user_id: string;
          image_path: string;
          caption: string | null;
          votes: number;
          hidden: boolean;
          cost_per_plate: number | null;
          minutes: number | null;
          swaps: string | null;
          notes: string | null;
          cost_source: "self" | "receipt" | null;
          receipt_store: string | null;
          receipt_verified_at: string | null;
          created_at: string;
        },
        "recipe_id" | "user_id" | "image_path"
      >;
      attempt_votes: Table<
        { attempt_id: string; user_id: string; challenge_id: string | null; created_at: string },
        "attempt_id" | "user_id"
      >;
      points_events: Table<
        {
          id: number;
          user_id: string;
          kind: PointsKind;
          points: number;
          ref: string;
          challenge_id: string | null;
          created_at: string;
        },
        "user_id" | "kind" | "points" | "ref"
      >;
      user_badges: Table<
        { id: number; user_id: string; badge: BadgeId; challenge_id: string | null; created_at: string },
        "user_id" | "badge"
      >;
      prize_awards: Table<
        {
          id: number;
          user_id: string;
          kind: "plus_months" | "gift_card" | "social_feature";
          reason: string;
          challenge_id: string | null;
          period: string | null;
          detail: string | null;
          status: "pending" | "fulfilled" | "cancelled";
          created_at: string;
          fulfilled_at: string | null;
        },
        "user_id" | "kind" | "reason"
      >;
      attempt_reports: Table<
        { attempt_id: string; user_id: string; reason: string | null; created_at: string },
        "attempt_id" | "user_id"
      >;
      referral_events: Table<
        {
          id: number;
          referrer_id: string;
          referred_user_id: string | null;
          visitor_id: string | null;
          kind: "visit" | "signup" | "cook";
          recipe_id: string | null;
          created_at: string;
        },
        "referrer_id" | "kind"
      >;
      waitlist: Table<
        { id: number; email: string; referred_by_code: string | null; source: string | null; created_at: string },
        "email"
      >;
      scans: Table<
        {
          id: number;
          user_id: string | null;
          visitor_id: string | null;
          ip_hash: string | null;
          ok: boolean;
          input_tokens: number | null;
          output_tokens: number | null;
          created_at: string;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      cast_vote: { Args: { p_attempt: string; p_user: string }; Returns: Json };
      random_referral_code: { Args: Record<string, never>; Returns: string };
      savings_total: { Args: Record<string, never>; Returns: Json };
      top_savers: { Args: { p_since: string; p_limit: number; p_until?: string | null }; Returns: { user_id: string; saved: number; meals: number }[] };
      my_savings: { Args: { p_user: string }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
