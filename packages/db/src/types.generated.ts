export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_generations: {
        Row: {
          cost_micros: number | null
          created_at: string
          error_message: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          mode: string
          model: string
          output_tokens: number | null
          prompt_version: string
          result_json: Json | null
          site_id: string | null
          status: string
          target_key: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          cost_micros?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          mode: string
          model: string
          output_tokens?: number | null
          prompt_version: string
          result_json?: Json | null
          site_id?: string | null
          status?: string
          target_key?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          cost_micros?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          mode?: string
          model?: string
          output_tokens?: number | null
          prompt_version?: string
          result_json?: Json | null
          site_id?: string | null
          status?: string
          target_key?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          alt_text: string | null
          asset_slot: string | null
          byte_size: number
          created_at: string
          created_by: string | null
          height: number | null
          id: string
          mime_type: string
          site_id: string | null
          storage_path: string
          tenant_id: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          asset_slot?: string | null
          byte_size: number
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          mime_type: string
          site_id?: string | null
          storage_path: string
          tenant_id: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          asset_slot?: string | null
          byte_size?: number
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          site_id?: string | null
          storage_path?: string
          tenant_id?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: unknown
          is_support_mode: boolean
          payload_json: Json
          support_reason: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: unknown
          is_support_mode?: boolean
          payload_json?: Json
          support_reason?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: unknown
          is_support_mode?: boolean
          payload_json?: Json
          support_reason?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          attribution_json: Json
          consent_at: string | null
          consent_purpose: string | null
          consent_text_version: string | null
          created_at: string
          full_name: string | null
          id: string
          normalized_email: string | null
          normalized_phone: string | null
          site_id: string | null
          source: string | null
          status:
            | "new"
            | "contacted"
            | "converted"
            | "discarded"
            | "unsubscribed"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attribution_json?: Json
          consent_at?: string | null
          consent_purpose?: string | null
          consent_text_version?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          site_id?: string | null
          source?: string | null
          status?:
            | "new"
            | "contacted"
            | "converted"
            | "discarded"
            | "unsubscribed"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attribution_json?: Json
          consent_at?: string | null
          consent_purpose?: string | null
          consent_text_version?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          site_id?: string | null
          source?: string | null
          status?:
            | "new"
            | "contacted"
            | "converted"
            | "discarded"
            | "unsubscribed"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          hostname: string
          id: string
          is_canonical: boolean
          is_subdomain: boolean
          last_checked_at: string | null
          site_id: string
          status: "pending" | "verifying" | "active" | "failed" | "removed"
          tenant_id: string
          updated_at: string
          verification_json: Json
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          is_canonical?: boolean
          is_subdomain?: boolean
          last_checked_at?: string | null
          site_id: string
          status?: "pending" | "verifying" | "active" | "failed" | "removed"
          tenant_id: string
          updated_at?: string
          verification_json?: Json
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          is_canonical?: boolean
          is_subdomain?: boolean
          last_checked_at?: string | null
          site_id?: string
          status?: "pending" | "verifying" | "active" | "failed" | "removed"
          tenant_id?: string
          updated_at?: string
          verification_json?: Json
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domains_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          config_json: Json
          created_at: string
          enabled: boolean
          id: string
          key: string
          site_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          site_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          site_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          compare_at_amount: number | null
          created_at: string
          currency: string
          id: string
          inventory: number | null
          is_active: boolean
          payment_methods: ("cod" | "transfer" | "online")[]
          price_amount: number
          shipping_amount: number
          site_id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          compare_at_amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          inventory?: number | null
          is_active?: boolean
          payment_methods?: ("cod" | "transfer" | "online")[]
          price_amount: number
          shipping_amount?: number
          site_id: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          compare_at_amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          inventory?: number | null
          is_active?: boolean
          payment_methods?: ("cod" | "transfer" | "online")[]
          price_amount?: number
          shipping_amount?: number
          site_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          flow_key: string
          id: string
          site_id: string | null
          status: string
          step_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          flow_key: string
          id?: string
          site_id?: string | null
          status?: string
          step_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          flow_key?: string
          id?: string
          site_id?: string | null
          status?: string
          step_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_counters: {
        Row: {
          next_value: number
          tenant_id: string
        }
        Insert: {
          next_value?: number
          tenant_id: string
        }
        Update: {
          next_value?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          quantity: number
          tenant_id: string
          title: string
          unit_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          quantity: number
          tenant_id: string
          title: string
          unit_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          quantity?: number
          tenant_id?: string
          title?: string
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          attribution_json: Json
          city: string
          contact_id: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_notes: string | null
          discount_amount: number
          id: string
          idempotency_key: string | null
          notes: string | null
          offer_snapshot: Json
          order_number: string
          payment_method: "cod" | "transfer" | "online"
          shipping_amount: number
          site_id: string
          status:
            | "new"
            | "pending_confirmation"
            | "confirmed"
            | "preparing"
            | "shipped"
            | "delivered"
            | "cancelled"
            | "returned"
          subtotal_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          address: string
          attribution_json?: Json
          city: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_notes?: string | null
          discount_amount?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          offer_snapshot?: Json
          order_number: string
          payment_method?: "cod" | "transfer" | "online"
          shipping_amount?: number
          site_id: string
          status?:
            | "new"
            | "pending_confirmation"
            | "confirmed"
            | "preparing"
            | "shipped"
            | "delivered"
            | "cancelled"
            | "returned"
          subtotal_amount: number
          tenant_id: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          address?: string
          attribution_json?: Json
          city?: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_notes?: string | null
          discount_amount?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          offer_snapshot?: Json
          order_number?: string
          payment_method?: "cod" | "transfer" | "online"
          shipping_amount?: number
          site_id?: string
          status?:
            | "new"
            | "pending_confirmation"
            | "confirmed"
            | "preparing"
            | "shipped"
            | "delivered"
            | "cancelled"
            | "returned"
          subtotal_amount?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          display_name: string
          id: string
          is_active: boolean
          limits_json: Json
          price_amount: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_name: string
          id: string
          is_active?: boolean
          limits_json?: Json
          price_amount?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_name?: string
          id?: string
          is_active?: boolean
          limits_json?: Json
          price_amount?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_content_drafts: {
        Row: {
          content_json: Json
          created_at: string
          revision: number
          site_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_json?: Json
          created_at?: string
          revision?: number
          site_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_json?: Json
          created_at?: string
          revision?: number
          site_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_content_drafts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_content_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_metrics_daily: {
        Row: {
          metric_date: string
          orders: number
          page_views: number
          revenue: number
          revenue_cancelled: number
          site_id: string
          subscribers: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          metric_date: string
          orders?: number
          page_views?: number
          revenue?: number
          revenue_cancelled?: number
          site_id: string
          subscribers?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          metric_date?: string
          orders?: number
          page_views?: number
          revenue?: number
          revenue_cancelled?: number
          site_id?: string
          subscribers?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_metrics_daily_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_metrics_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_publications: {
        Row: {
          content_json: Json
          id: string
          offer_snapshot: Json
          publication_number: number
          published_at: string
          published_by: string | null
          site_id: string
          template_version_id: string
          tenant_id: string
        }
        Insert: {
          content_json: Json
          id?: string
          offer_snapshot?: Json
          publication_number: number
          published_at?: string
          published_by?: string | null
          site_id: string
          template_version_id: string
          tenant_id: string
        }
        Update: {
          content_json?: Json
          id?: string
          offer_snapshot?: Json
          publication_number?: number
          published_at?: string
          published_by?: string | null
          site_id?: string
          template_version_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_publications_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_publications_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_publications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          archived_at: string | null
          created_at: string
          first_publish_reviewed_at: string | null
          id: string
          name: string
          preview_token: string
          published_publication_id: string | null
          status: "draft" | "published" | "paused" | "archived"
          template_version_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          first_publish_reviewed_at?: string | null
          id?: string
          name: string
          preview_token?: string
          published_publication_id?: string | null
          status?: "draft" | "published" | "paused" | "archived"
          template_version_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          first_publish_reviewed_at?: string | null
          id?: string
          name?: string
          preview_token?: string
          published_publication_id?: string | null
          status?: "draft" | "published" | "paused" | "archived"
          template_version_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_published_publication_fk"
            columns: ["published_publication_id"]
            isOneToOne: false
            referencedRelation: "site_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      template_requests: {
        Row: {
          brief_json: Json
          created_at: string
          currency: string
          delivered_template_id: string | null
          id: string
          quoted_amount: number | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brief_json?: Json
          created_at?: string
          currency?: string
          delivered_template_id?: string | null
          id?: string
          quoted_amount?: number | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brief_json?: Json
          created_at?: string
          currency?: string
          delivered_template_id?: string | null
          id?: string
          quoted_amount?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_requests_delivered_template_id_fkey"
            columns: ["delivered_template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          changelog: string | null
          component_key: string
          content_schema: Json
          created_at: string
          default_content: Json
          id: string
          manifest_json: Json
          min_renderer_version: string
          published_at: string | null
          status:
            | "development"
            | "preview"
            | "approved"
            | "published"
            | "hidden"
            | "deprecated"
          template_id: string
          updated_at: string
          version: string
        }
        Insert: {
          changelog?: string | null
          component_key: string
          content_schema: Json
          created_at?: string
          default_content: Json
          id?: string
          manifest_json: Json
          min_renderer_version?: string
          published_at?: string | null
          status?:
            | "development"
            | "preview"
            | "approved"
            | "published"
            | "hidden"
            | "deprecated"
          template_id: string
          updated_at?: string
          version: string
        }
        Update: {
          changelog?: string | null
          component_key?: string
          content_schema?: Json
          created_at?: string
          default_content?: Json
          id?: string
          manifest_json?: Json
          min_renderer_version?: string
          published_at?: string | null
          status?:
            | "development"
            | "preview"
            | "approved"
            | "published"
            | "hidden"
            | "deprecated"
          template_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          allowed_plan_ids: string[] | null
          category: string | null
          created_at: string
          demo_url: string | null
          description: string | null
          display_name: string
          id: string
          is_featured: boolean
          origin: "catalog" | "custom"
          owner_tenant_id: string | null
          template_key: string
          thumbnail_url: string | null
          updated_at: string
          visibility: "public" | "private" | "hidden"
        }
        Insert: {
          allowed_plan_ids?: string[] | null
          category?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_featured?: boolean
          origin?: "catalog" | "custom"
          owner_tenant_id?: string | null
          template_key: string
          thumbnail_url?: string | null
          updated_at?: string
          visibility?: "public" | "private" | "hidden"
        }
        Update: {
          allowed_plan_ids?: string[] | null
          category?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_featured?: boolean
          origin?: "catalog" | "custom"
          owner_tenant_id?: string | null
          template_key?: string
          thumbnail_url?: string | null
          updated_at?: string
          visibility?: "public" | "private" | "hidden"
        }
        Relationships: [
          {
            foreignKeyName: "templates_owner_tenant_id_fkey"
            columns: ["owner_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          invited_by: string | null
          role: "owner" | "editor" | "viewer"
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          role?: "owner" | "editor" | "viewer"
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          role?: "owner" | "editor" | "viewer"
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          billing_status: "trial" | "active" | "past_due" | "suspended"
          commerce_source: string
          country: string
          created_at: string
          currency: string
          grace_until: string | null
          id: string
          name: string
          nitro_bot_enabled: boolean
          nitro_bot_tenant_id: string | null
          plan_id: string | null
          slug: string
          status: "active" | "suspended" | "archived"
          updated_at: string
          web_chat_enabled: boolean
          whatsapp_enabled: boolean
          whatsapp_number: string | null
          whatsapp_template: string | null
        }
        Insert: {
          billing_status?: "trial" | "active" | "past_due" | "suspended"
          commerce_source?: string
          country?: string
          created_at?: string
          currency?: string
          grace_until?: string | null
          id?: string
          name: string
          nitro_bot_enabled?: boolean
          nitro_bot_tenant_id?: string | null
          plan_id?: string | null
          slug: string
          status?: "active" | "suspended" | "archived"
          updated_at?: string
          web_chat_enabled?: boolean
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
          whatsapp_template?: string | null
        }
        Update: {
          billing_status?: "trial" | "active" | "past_due" | "suspended"
          commerce_source?: string
          country?: string
          created_at?: string
          currency?: string
          grace_until?: string | null
          id?: string
          name?: string
          nitro_bot_enabled?: boolean
          nitro_bot_tenant_id?: string | null
          plan_id?: string | null
          slug?: string
          status?: "active" | "suspended" | "archived"
          updated_at?: string
          web_chat_enabled?: boolean
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
          whatsapp_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_monthly: {
        Row: {
          metric: string
          period: string
          tenant_id: string
          updated_at: string
          value: number
        }
        Insert: {
          metric: string
          period: string
          tenant_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          metric?: string
          period?: string
          tenant_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_monthly_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_public_order: {
        Args: {
          p_address: string
          p_attribution?: Json
          p_city: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone: string
          p_delivery_notes?: string
          p_idempotency_key?: string
          p_payment_method?: "cod" | "transfer" | "online"
          p_quantity?: number
          p_site_id: string
        }
        Returns: {
          currency: string
          order_id: string
          order_number: string
          total_amount: number
        }[]
      }
      record_page_view: { Args: { p_site_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
