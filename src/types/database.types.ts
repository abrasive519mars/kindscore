export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          diff: Json;
          id: string;
          target_id: string | null;
          target_table: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json;
          id?: string;
          target_id?: string | null;
          target_table: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json;
          id?: string;
          target_id?: string | null;
          target_table?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      charities: {
        Row: {
          category: string;
          city: string;
          cover_path: string | null;
          created_at: string;
          description: string;
          featured_rank: number | null;
          id: string;
          is_active: boolean;
          name: string;
          outcome_line: string;
          slug: string;
          tagline: string;
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          category: string;
          city?: string;
          cover_path?: string | null;
          created_at?: string;
          description?: string;
          featured_rank?: number | null;
          id?: string;
          is_active?: boolean;
          name: string;
          outcome_line?: string;
          slug: string;
          tagline?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          category?: string;
          city?: string;
          cover_path?: string | null;
          created_at?: string;
          description?: string;
          featured_rank?: number | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          outcome_line?: string;
          slug?: string;
          tagline?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      charity_contributions: {
        Row: {
          amount_paise: number;
          charity_id: string;
          created_at: string;
          donation_id: string | null;
          id: string;
          payment_id: string | null;
          source: Database["public"]["Enums"]["contribution_source"];
          user_id: string;
        };
        Insert: {
          amount_paise: number;
          charity_id: string;
          created_at?: string;
          donation_id?: string | null;
          id?: string;
          payment_id?: string | null;
          source: Database["public"]["Enums"]["contribution_source"];
          user_id: string;
        };
        Update: {
          amount_paise?: number;
          charity_id?: string;
          created_at?: string;
          donation_id?: string | null;
          id?: string;
          payment_id?: string | null;
          source?: Database["public"]["Enums"]["contribution_source"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "charity_contributions_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charity_contributions_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charity_totals";
            referencedColumns: ["charity_id"];
          },
          {
            foreignKeyName: "charity_contributions_donation_id_fkey";
            columns: ["donation_id"];
            isOneToOne: true;
            referencedRelation: "donations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charity_contributions_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: true;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charity_contributions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      charity_events: {
        Row: {
          charity_id: string;
          created_at: string;
          description: string;
          id: string;
          location: string;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          charity_id: string;
          created_at?: string;
          description?: string;
          id?: string;
          location?: string;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          charity_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          location?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "charity_events_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charity_events_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charity_totals";
            referencedColumns: ["charity_id"];
          },
        ];
      };
      charity_media: {
        Row: {
          alt: string;
          charity_id: string;
          id: string;
          sort_order: number;
          storage_path: string;
        };
        Insert: {
          alt?: string;
          charity_id: string;
          id?: string;
          sort_order?: number;
          storage_path: string;
        };
        Update: {
          alt?: string;
          charity_id?: string;
          id?: string;
          sort_order?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "charity_media_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charity_media_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charity_totals";
            referencedColumns: ["charity_id"];
          },
        ];
      };
      donations: {
        Row: {
          amount_paise: number;
          charity_id: string;
          created_at: string;
          id: string;
          paid: boolean;
          stripe_checkout_session_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_paise: number;
          charity_id: string;
          created_at?: string;
          id?: string;
          paid?: boolean;
          stripe_checkout_session_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_paise?: number;
          charity_id?: string;
          created_at?: string;
          id?: string;
          paid?: boolean;
          stripe_checkout_session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "donations_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "donations_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charity_totals";
            referencedColumns: ["charity_id"];
          },
          {
            foreignKeyName: "donations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      draw_entries: {
        Row: {
          draw_id: string;
          id: string;
          match_count: number;
          scores: number[];
          user_id: string;
        };
        Insert: {
          draw_id: string;
          id?: string;
          match_count?: number;
          scores: number[];
          user_id: string;
        };
        Update: {
          draw_id?: string;
          id?: string;
          match_count?: number;
          scores?: number[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "draw_entries_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "draw_statistics";
            referencedColumns: ["draw_id"];
          },
          {
            foreignKeyName: "draw_entries_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "draw_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      draw_results: {
        Row: {
          draw_id: string;
          entry_id: string;
          id: string;
          match_count: number;
          prize_paise: number;
          user_id: string;
        };
        Insert: {
          draw_id: string;
          entry_id: string;
          id?: string;
          match_count: number;
          prize_paise: number;
          user_id: string;
        };
        Update: {
          draw_id?: string;
          entry_id?: string;
          id?: string;
          match_count?: number;
          prize_paise?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "draw_results_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "draw_statistics";
            referencedColumns: ["draw_id"];
          },
          {
            foreignKeyName: "draw_results_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "draw_results_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "draw_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "draw_results_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      draws: {
        Row: {
          active_subscriber_count: number;
          created_at: string;
          draw_month: string;
          entries_hash: string | null;
          four_pool_paise: number;
          id: string;
          jackpot_pool_paise: number;
          mode: Database["public"]["Enums"]["draw_mode"];
          numbers: number[] | null;
          pool_paise: number;
          pool_share_bps: number;
          published_at: string | null;
          published_by: string | null;
          rollover_in_paise: number;
          rollover_out_paise: number;
          simulated_at: string | null;
          status: Database["public"]["Enums"]["draw_status"];
          three_pool_paise: number;
          unclaimed_retained_paise: number;
          updated_at: string;
        };
        Insert: {
          active_subscriber_count?: number;
          created_at?: string;
          draw_month: string;
          entries_hash?: string | null;
          four_pool_paise?: number;
          id?: string;
          jackpot_pool_paise?: number;
          mode?: Database["public"]["Enums"]["draw_mode"];
          numbers?: number[] | null;
          pool_paise?: number;
          pool_share_bps?: number;
          published_at?: string | null;
          published_by?: string | null;
          rollover_in_paise?: number;
          rollover_out_paise?: number;
          simulated_at?: string | null;
          status?: Database["public"]["Enums"]["draw_status"];
          three_pool_paise?: number;
          unclaimed_retained_paise?: number;
          updated_at?: string;
        };
        Update: {
          active_subscriber_count?: number;
          created_at?: string;
          draw_month?: string;
          entries_hash?: string | null;
          four_pool_paise?: number;
          id?: string;
          jackpot_pool_paise?: number;
          mode?: Database["public"]["Enums"]["draw_mode"];
          numbers?: number[] | null;
          pool_paise?: number;
          pool_share_bps?: number;
          published_at?: string | null;
          published_by?: string | null;
          rollover_in_paise?: number;
          rollover_out_paise?: number;
          simulated_at?: string | null;
          status?: Database["public"]["Enums"]["draw_status"];
          three_pool_paise?: number;
          unclaimed_retained_paise?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "draws_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_paise: number;
          charity_bps: number;
          charity_id: string;
          charity_paise: number;
          id: string;
          paid_at: string;
          platform_paise: number;
          pool_paise: number;
          stripe_invoice_id: string;
          subscription_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_paise: number;
          charity_bps: number;
          charity_id: string;
          charity_paise: number;
          id?: string;
          paid_at?: string;
          platform_paise: number;
          pool_paise: number;
          stripe_invoice_id: string;
          subscription_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_paise?: number;
          charity_bps?: number;
          charity_id?: string;
          charity_paise?: number;
          id?: string;
          paid_at?: string;
          platform_paise?: number;
          pool_paise?: number;
          stripe_invoice_id?: string;
          subscription_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_charity_id_fkey";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charity_totals";
            referencedColumns: ["charity_id"];
          },
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          charity_bps: number;
          charity_id: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          stripe_customer_id: string | null;
          updated_at: string;
        };
        Insert: {
          charity_bps?: number;
          charity_id?: string | null;
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          charity_bps?: number;
          charity_id?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_charity_fk";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_charity_fk";
            columns: ["charity_id"];
            isOneToOne: false;
            referencedRelation: "charity_totals";
            referencedColumns: ["charity_id"];
          },
        ];
      };
      scores: {
        Row: {
          created_at: string;
          id: string;
          played_on: string;
          score: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          played_on: string;
          score: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          played_on?: string;
          score?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scores_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          processed_at: string | null;
          received_at: string;
          type: string;
        };
        Insert: {
          id: string;
          processed_at?: string | null;
          received_at?: string;
          type: string;
        };
        Update: {
          id?: string;
          processed_at?: string | null;
          received_at?: string;
          type?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string;
          current_period_start: string;
          id: string;
          last_event_at: string | null;
          plan_interval: Database["public"]["Enums"]["plan_interval"];
          source: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_price_id: string;
          stripe_subscription_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end: string;
          current_period_start: string;
          id?: string;
          last_event_at?: string | null;
          plan_interval: Database["public"]["Enums"]["plan_interval"];
          source?: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_price_id: string;
          stripe_subscription_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string;
          current_period_start?: string;
          id?: string;
          last_event_at?: string | null;
          plan_interval?: Database["public"]["Enums"]["plan_interval"];
          source?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_price_id?: string;
          stripe_subscription_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      winner_verifications: {
        Row: {
          created_at: string;
          id: string;
          paid_at: string | null;
          payout_status: Database["public"]["Enums"]["payout_status"];
          proof_path: string | null;
          resubmissions: number;
          result_id: string;
          review_note: string | null;
          review_status: Database["public"]["Enums"]["review_status"];
          reviewed_at: string | null;
          reviewed_by: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          payout_status?: Database["public"]["Enums"]["payout_status"];
          proof_path?: string | null;
          resubmissions?: number;
          result_id: string;
          review_note?: string | null;
          review_status?: Database["public"]["Enums"]["review_status"];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          payout_status?: Database["public"]["Enums"]["payout_status"];
          proof_path?: string | null;
          resubmissions?: number;
          result_id?: string;
          review_note?: string | null;
          review_status?: Database["public"]["Enums"]["review_status"];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "winner_verifications_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: true;
            referencedRelation: "draw_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "winner_verifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "winner_verifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      charity_totals: {
        Row: {
          charity_id: string | null;
          contributor_count: number | null;
          is_active: boolean | null;
          name: string | null;
          slug: string | null;
          total_paise: number | null;
        };
        Relationships: [];
      };
      draw_statistics: {
        Row: {
          active_subscriber_count: number | null;
          draw_id: string | null;
          draw_month: string | null;
          five_match_winners: number | null;
          four_match_winners: number | null;
          four_pool_paise: number | null;
          jackpot_pool_paise: number | null;
          mode: Database["public"]["Enums"]["draw_mode"] | null;
          numbers: number[] | null;
          pool_paise: number | null;
          prizes_paise: number | null;
          published_at: string | null;
          rollover_in_paise: number | null;
          rollover_out_paise: number | null;
          three_match_winners: number | null;
          three_pool_paise: number | null;
          unclaimed_retained_paise: number | null;
        };
        Relationships: [];
      };
      reports_summary: {
        Row: {
          active_subscribers: number | null;
          charity_total_paise: number | null;
          current_rollover_paise: number | null;
          pool_this_month_paise: number | null;
          prizes_awarded_paise: number | null;
          prizes_paid_paise: number | null;
          proofs_awaiting_review: number | null;
          total_members: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      active_subscriber_counts: {
        Args: never;
        Returns: {
          plan_interval: Database["public"]["Enums"]["plan_interval"];
          subscribers: number;
        }[];
      };
      has_active_access: { Args: { uid: string }; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      mark_winner_paid: {
        Args: { p_verification_id: string };
        Returns: {
          created_at: string;
          id: string;
          paid_at: string | null;
          payout_status: Database["public"]["Enums"]["payout_status"];
          proof_path: string | null;
          resubmissions: number;
          result_id: string;
          review_note: string | null;
          review_status: Database["public"]["Enums"]["review_status"];
          reviewed_at: string | null;
          reviewed_by: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "winner_verifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      next_rollover_in: { Args: never; Returns: number };
      publish_draw: {
        Args: { p_draw_id: string };
        Returns: {
          active_subscriber_count: number;
          created_at: string;
          draw_month: string;
          entries_hash: string | null;
          four_pool_paise: number;
          id: string;
          jackpot_pool_paise: number;
          mode: Database["public"]["Enums"]["draw_mode"];
          numbers: number[] | null;
          pool_paise: number;
          pool_share_bps: number;
          published_at: string | null;
          published_by: string | null;
          rollover_in_paise: number;
          rollover_out_paise: number;
          simulated_at: string | null;
          status: Database["public"]["Enums"]["draw_status"];
          three_pool_paise: number;
          unclaimed_retained_paise: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "draws";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_winner: {
        Args: { p_approve: boolean; p_note?: string; p_verification_id: string };
        Returns: {
          created_at: string;
          id: string;
          paid_at: string | null;
          payout_status: Database["public"]["Enums"]["payout_status"];
          proof_path: string | null;
          resubmissions: number;
          result_id: string;
          review_note: string | null;
          review_status: Database["public"]["Enums"]["review_status"];
          reviewed_at: string | null;
          reviewed_by: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "winner_verifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_simulation: {
        Args: {
          p_active_subscriber_count: number;
          p_draw_id: string;
          p_entries: Json;
          p_entries_hash: string;
          p_four_pool_paise: number;
          p_jackpot_pool_paise: number;
          p_mode: Database["public"]["Enums"]["draw_mode"];
          p_numbers: number[];
          p_pool_paise: number;
          p_results: Json;
          p_rollover_in_paise: number;
          p_rollover_out_paise: number;
          p_three_pool_paise: number;
          p_unclaimed_retained_paise: number;
        };
        Returns: {
          active_subscriber_count: number;
          created_at: string;
          draw_month: string;
          entries_hash: string | null;
          four_pool_paise: number;
          id: string;
          jackpot_pool_paise: number;
          mode: Database["public"]["Enums"]["draw_mode"];
          numbers: number[] | null;
          pool_paise: number;
          pool_share_bps: number;
          published_at: string | null;
          published_by: string | null;
          rollover_in_paise: number;
          rollover_out_paise: number;
          simulated_at: string | null;
          status: Database["public"]["Enums"]["draw_status"];
          three_pool_paise: number;
          unclaimed_retained_paise: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "draws";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_winner_proof: {
        Args: { p_proof_path: string; p_verification_id: string };
        Returns: {
          created_at: string;
          id: string;
          paid_at: string | null;
          payout_status: Database["public"]["Enums"]["payout_status"];
          proof_path: string | null;
          resubmissions: number;
          result_id: string;
          review_note: string | null;
          review_status: Database["public"]["Enums"]["review_status"];
          reviewed_at: string | null;
          reviewed_by: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "winner_verifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: "member" | "admin";
      contribution_source: "subscription" | "donation";
      draw_mode: "random" | "algorithmic";
      draw_status: "draft" | "simulated" | "published";
      payout_status: "pending" | "paid";
      plan_interval: "month" | "year";
      review_status: "awaiting_proof" | "submitted" | "approved" | "rejected";
      subscription_status: "active" | "past_due" | "cancelled" | "lapsed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["member", "admin"],
      contribution_source: ["subscription", "donation"],
      draw_mode: ["random", "algorithmic"],
      draw_status: ["draft", "simulated", "published"],
      payout_status: ["pending", "paid"],
      plan_interval: ["month", "year"],
      review_status: ["awaiting_proof", "submitted", "approved", "rejected"],
      subscription_status: ["active", "past_due", "cancelled", "lapsed"],
    },
  },
} as const;
