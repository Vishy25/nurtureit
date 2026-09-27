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
      activities: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string
          id: string
          kind: string
          occurred_at: string
          opportunity_id: string | null
          organization_id: string | null
          summary: string
          tenant_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          occurred_at?: string
          opportunity_id?: string | null
          organization_id?: string | null
          summary: string
          tenant_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          occurred_at?: string
          opportunity_id?: string | null
          organization_id?: string | null
          summary?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_settings: {
        Row: {
          agent: string
          enabled: boolean
          id: string
          prompt_version: string
          release_stage: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent: string
          enabled?: boolean
          id?: string
          prompt_version: string
          release_stage?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent?: string
          enabled?: boolean
          id?: string
          prompt_version?: string
          release_stage?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_evaluations: {
        Row: {
          agent: string
          created_at: string
          created_by: string
          id: string
          model: string
          pass_rate: number | null
          prompt_version: string
          results: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          agent: string
          created_at?: string
          created_by?: string
          id?: string
          model: string
          pass_rate?: number | null
          prompt_version: string
          results?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          agent?: string
          created_at?: string
          created_by?: string
          id?: string
          model?: string
          pass_rate?: number | null
          prompt_version?: string
          results?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory: {
        Row: {
          confidence: number
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          kind: string
          lead_id: string | null
          source: string
          tenant_id: string
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          kind: string
          lead_id?: string | null
          source?: string
          tenant_id: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          feedback: string | null
          id: string
          lead_id: string | null
          payload: Json
          run_id: string
          status: string
          task_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          feedback?: string | null
          id?: string
          lead_id?: string | null
          payload: Json
          run_id: string
          status?: string
          task_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          feedback?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json
          run_id?: string
          status?: string
          task_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          agent: string
          created_at: string
          created_by: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          input_snapshot: Json
          lead_id: string | null
          mode: string
          model: string
          output: Json | null
          prompt_version: string
          status: string
          tenant_id: string
        }
        Insert: {
          agent: string
          created_at?: string
          created_by?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_snapshot?: Json
          lead_id?: string | null
          mode?: string
          model: string
          output?: Json | null
          prompt_version: string
          status?: string
          tenant_id: string
        }
        Update: {
          agent?: string
          created_at?: string
          created_by?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_snapshot?: Json
          lead_id?: string | null
          mode?: string
          model?: string
          output?: Json | null
          prompt_version?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          content_type: string | null
          created_at: string
          created_by: string
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          size_bytes: number
          storage_path: string
          tenant_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          created_by?: string
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          size_bytes: number
          storage_path: string
          tenant_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          created_by?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          size_bytes?: number
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: string
          action_config: Json
          condition: Json
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          name: string
          tenant_id: string
          trigger_event: string
        }
        Insert: {
          action: string
          action_config?: Json
          condition?: Json
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          name: string
          tenant_id: string
          trigger_event: string
        }
        Update: {
          action?: string
          action_config?: Json
          condition?: Json
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          name?: string
          tenant_id?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          created_at: string
          detail: string | null
          entity_id: string
          event_key: string
          id: string
          rule_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          entity_id: string
          event_key: string
          id?: string
          rule_id: string
          status: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          entity_id?: string
          event_key?: string
          id?: string
          rule_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_preferences: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          contact_id: string
          created_at: string
          created_by: string
          id: string
          locations: string[]
          min_bedrooms: number | null
          notes: string | null
          property_types: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          contact_id: string
          created_at?: string
          created_by?: string
          id?: string
          locations?: string[]
          min_bedrooms?: number | null
          notes?: string | null
          property_types?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          contact_id?: string
          created_at?: string
          created_by?: string
          id?: string
          locations?: string[]
          min_bedrooms?: number | null
          notes?: string | null
          property_types?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_preferences_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          consent_source: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          email: string | null
          full_name: string
          id: string
          marketing_consent: boolean
          notes: string | null
          organization_id: string | null
          owner_id: string | null
          phone: string | null
          preferred_channel: string
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          consent_source?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          email?: string | null
          full_name: string
          id?: string
          marketing_consent?: boolean
          notes?: string | null
          organization_id?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_channel?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          consent_source?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          email?: string | null
          full_name?: string
          id?: string
          marketing_consent?: boolean
          notes?: string | null
          organization_id?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_channel?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      custom_field_defs: {
        Row: {
          created_at: string
          entity: string
          field_key: string
          field_type: string
          id: string
          label: string
          options: string[]
          position: number
          required: boolean
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity?: string
          field_key: string
          field_type: string
          id?: string
          label: string
          options?: string[]
          position?: number
          required?: boolean
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          options?: string[]
          position?: number
          required?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_defs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_snapshots: {
        Row: {
          created_at: string
          created_by: string
          id: string
          open_count: number
          open_value: number
          tenant_id: string
          weighted_value: number
          won_value_month: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          open_count?: number
          open_value?: number
          tenant_id: string
          weighted_value?: number
          won_value_month?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          open_count?: number
          open_value?: number
          tenant_id?: string
          weighted_value?: number
          won_value_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "forecast_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_credentials: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_events: {
        Row: {
          attempts: number
          correlation_id: string
          credential_id: string | null
          error: string | null
          id: string
          idempotency_key: string
          lead_id: string | null
          payload: Json
          processed_at: string | null
          received_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          correlation_id: string
          credential_id?: string | null
          error?: string | null
          id?: string
          idempotency_key: string
          lead_id?: string | null
          payload: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          correlation_id?: string
          credential_id?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string
          lead_id?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_events_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "intake_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_history: {
        Row: {
          breakdown: Json
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          reason: string | null
          score: number
          source: string
          tenant_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          score: number
          source?: string
          tenant_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          score?: number
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_score_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          created_by: string
          custom_fields: Json
          email: string | null
          full_name: string
          id: string
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          provenance: Json
          score: number | null
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          custom_fields?: Json
          email?: string | null
          full_name: string
          id?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          provenance?: Json
          score?: number | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          custom_fields?: Json
          email?: string | null
          full_name?: string
          id?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          provenance?: Json
          score?: number | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          tenant_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          tenant_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          tenant_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          created_by: string
          currency: string
          id: string
          opportunity_id: string | null
          property_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          opportunity_id?: string | null
          property_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          opportunity_id?: string | null
          property_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      opportunities: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string
          expected_close: string | null
          follow_up_at: string | null
          id: string
          lead_id: string | null
          lost_reason: string | null
          name: string
          organization_id: string | null
          owner_id: string | null
          stage: Database["public"]["Enums"]["opp_stage"]
          state: Database["public"]["Enums"]["opp_state"]
          tenant_id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          expected_close?: string | null
          follow_up_at?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["opp_stage"]
          state?: Database["public"]["Enums"]["opp_state"]
          tenant_id: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          expected_close?: string | null
          follow_up_at?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["opp_stage"]
          state?: Database["public"]["Enums"]["opp_state"]
          tenant_id?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage: Database["public"]["Enums"]["opp_stage"] | null
          from_state: Database["public"]["Enums"]["opp_state"] | null
          id: string
          opportunity_id: string
          reason: string | null
          tenant_id: string
          to_stage: Database["public"]["Enums"]["opp_stage"]
          to_state: Database["public"]["Enums"]["opp_state"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["opp_stage"] | null
          from_state?: Database["public"]["Enums"]["opp_state"] | null
          id?: string
          opportunity_id: string
          reason?: string | null
          tenant_id: string
          to_stage: Database["public"]["Enums"]["opp_stage"]
          to_state: Database["public"]["Enums"]["opp_state"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["opp_stage"] | null
          from_state?: Database["public"]["Enums"]["opp_state"] | null
          id?: string
          opportunity_id?: string
          reason?: string | null
          tenant_id?: string
          to_stage?: Database["public"]["Enums"]["opp_stage"]
          to_state?: Database["public"]["Enums"]["opp_state"]
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          industry: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          amenities: string[]
          area_sqft: number | null
          bedrooms: number | null
          created_at: string
          created_by: string
          currency: string
          id: string
          location: string | null
          notes: string | null
          price: number | null
          project: string | null
          property_type: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          area_sqft?: number | null
          bedrooms?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          location?: string | null
          notes?: string | null
          price?: number | null
          project?: string | null
          property_type?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          area_sqft?: number | null
          bedrooms?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          location?: string | null
          notes?: string | null
          price?: number | null
          project?: string | null
          property_type?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          created_at: string
          created_by: string
          deals_target: number
          id: string
          period_month: string
          revenue_target: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deals_target?: number
          id?: string
          period_month: string
          revenue_target?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deals_target?: number
          id?: string
          period_month?: string
          revenue_target?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlists: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string
          id: string
          property_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string
          id?: string
          property_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string
          id?: string
          property_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortlists_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlists_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string
          id: string
          outcome: string | null
          property_id: string
          scheduled_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string
          id?: string
          outcome?: string | null
          property_id: string
          scheduled_at: string
          status?: string
          tenant_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string
          id?: string
          outcome?: string | null
          property_id?: string
          scheduled_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          kind: string
          lead_id: string | null
          notes: string | null
          opportunity_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ai_autonomy: string
          ai_daily_run_limit: number
          ai_paused: boolean
          created_at: string
          created_by: string | null
          default_currency: string
          id: string
          industry: string
          is_demo: boolean
          name: string
          scoring_config: Json | null
          slug: string
          stage_labels: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_autonomy?: string
          ai_daily_run_limit?: number
          ai_paused?: boolean
          created_at?: string
          created_by?: string | null
          default_currency?: string
          id?: string
          industry?: string
          is_demo?: boolean
          name: string
          scoring_config?: Json | null
          slug: string
          stage_labels?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_autonomy?: string
          ai_daily_run_limit?: number
          ai_paused?: boolean
          created_at?: string
          created_by?: string | null
          default_currency?: string
          id?: string
          industry?: string
          is_demo?: boolean
          name?: string
          scoring_config?: Json | null
          slug?: string
          stage_labels?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      convert_lead: {
        Args: {
          _deal_name: string
          _expected_close?: string
          _lead_id: string
          _value?: number
        }
        Returns: string
      }
      create_tenant: {
        Args: { _industry?: string; _is_demo?: boolean; _name: string }
        Returns: string
      }
      ensure_profile: { Args: never; Returns: undefined }
      has_tenant_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _tenant_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
      move_opportunity: {
        Args: {
          _follow_up?: string
          _id: string
          _reason?: string
          _to_stage: Database["public"]["Enums"]["opp_stage"]
          _to_state: Database["public"]["Enums"]["opp_state"]
        }
        Returns: undefined
      }
      run_automations: {
        Args: {
          _ctx: Json
          _entity: string
          _event: string
          _event_key: string
          _tenant: string
        }
        Returns: undefined
      }
      seed_demo_tenant: { Args: { _name: string }; Returns: string }
      shares_tenant_with: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "tenant_admin"
        | "sales_manager"
        | "sales_rep"
        | "ops_coordinator"
        | "analyst"
      lead_status:
        | "new"
        | "accepted"
        | "nurturing"
        | "disqualified"
        | "converted"
      membership_status: "active" | "invited" | "deactivated"
      opp_stage:
        | "qualification"
        | "discovery"
        | "shortlist"
        | "site_visit"
        | "negotiation"
        | "closing"
        | "closed_won"
      opp_state: "open" | "on_hold" | "nurturing" | "won" | "lost"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "tenant_admin",
        "sales_manager",
        "sales_rep",
        "ops_coordinator",
        "analyst",
      ],
      lead_status: [
        "new",
        "accepted",
        "nurturing",
        "disqualified",
        "converted",
      ],
      membership_status: ["active", "invited", "deactivated"],
      opp_stage: [
        "qualification",
        "discovery",
        "shortlist",
        "site_visit",
        "negotiation",
        "closing",
        "closed_won",
      ],
      opp_state: ["open", "on_hold", "nurturing", "won", "lost"],
    },
  },
} as const
